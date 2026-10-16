import { NextResponse } from "next/server";
import { analyzeReport, readByokConfig } from "@/lib/providers";
import { createIssueFromAnalysis, getClusterSummary, listIssues } from "@/lib/store";
import { savePhoto, UploadError, type SavedUpload } from "@/lib/uploads";
import { analyzeIssue } from "@/lib/analyzer";
import { createReceipt } from "@/lib/receipts";
import { getStore } from "@/lib/storage";
import { seasonalModes } from "@/lib/modes";
import type {
  AnalyzeIssueInput,
  IssueStatus,
  ReportSubmissionResult,
  SeasonalModeId,
  Severity
} from "@/types/civic";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const issues = listIssues({
    mode: (params.get("mode") as SeasonalModeId) || undefined,
    severity: (params.get("severity") as Severity) || undefined,
    status: (params.get("status") as IssueStatus | "open") || undefined,
    groupId: params.get("groupId") || undefined
  });

  return NextResponse.json({ issues });
}

export async function POST(request: Request) {
  let text = "";
  let locationText = "";
  let landmark: string | undefined;
  let userSelectedMode: SeasonalModeId | undefined;
  let photo: SavedUpload | undefined;
  let photoFile: File | undefined;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      text = String(form.get("text") || "").trim();
      locationText = String(form.get("location") || "").trim();
      landmark = String(form.get("landmark") || "").trim() || undefined;
      userSelectedMode = (String(form.get("mode") || "") as SeasonalModeId) || undefined;
      const file = form.get("photo");

      if (file instanceof File && file.size > 0) {
        photoFile = file;
      }
    } else {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body) ||
          [body.text, body.location, body.landmark, body.mode].some(value => value !== undefined && typeof value !== "string")) {
        return NextResponse.json({ error: "Report fields must be text." }, { status: 400 });
      }
      text = String(body.text || "").trim();
      locationText = String(body.location || "").trim();
      landmark = body.landmark ? String(body.landmark) : undefined;
      userSelectedMode = body.mode || undefined;
    }
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (userSelectedMode && !seasonalModes.some(mode => mode.id === userSelectedMode)) {
    return NextResponse.json({ error: "Choose a supported seasonal mode." }, { status: 400 });
  }
  if (text.length > 10000 || locationText.length > 500 || (landmark?.length ?? 0) > 500) {
    return NextResponse.json({ error: "Use at most 10,000 characters for the report and 500 for each place field." }, { status: 400 });
  }
  if (photoFile) {
    try { photo = await savePhoto(photoFile); }
    catch (error) {
      return NextResponse.json({ error: error instanceof UploadError ? error.message : "Photo could not be saved. Try again." }, { status: error instanceof UploadError ? 400 : 500 });
    }
  }
  if (!text && !photo) {
    return NextResponse.json(
      { error: "Describe the issue or attach a photo." },
      { status: 400 }
    );
  }

  const input: AnalyzeIssueInput = {
    text,
    imageDescription: photo ? "Citizen-attached photo of the reported issue." : undefined,
    date: new Date().toISOString(),
    approximateLocation: locationText || undefined,
    userSelectedMode
  };

  const byok = readByokConfig(request.headers);

  // The rules receipt is durable before any optional inference request.
  let issue = createIssueFromAnalysis({
    rawText: text || "(photo-only report)",
    analysis: analyzeIssue(input),
    locationText: locationText || "Location not provided",
    landmark,
    photoUrl: photo?.publicUrl,
    analysisEngine: "rules"
  });
  let analysisWarning: string | undefined;
  try {
    const { output, engine } = await analyzeReport(input, {
      photo: photo ? { base64: photo.base64, mimeType: photo.mimeType } : undefined,
      byok
    });
    if (engine !== "rules") {
      getStore().updateAnalysis({ ...issue, title: `${output.category} at ${issue.locationText}`, cleanSummary: output.cleanSummary,
        mode: output.mode, category: output.category, subcategories: output.subcategories,
        severity: output.severity, riskFlags: output.riskFlags,
        departmentSuggestions: output.departmentSuggestions,
        receipt: createReceipt(issue.id, output), analysisEngine: engine });
      issue = getStore().get(issue.id)!;
    } else if (byok || process.env.GEMMA_ENABLED === "true") {
      analysisWarning = "Report saved. The model was unavailable; this receipt uses rules.";
    }
  } catch {
    analysisWarning = "Report saved. Optional analysis could not be applied.";
  }

  const cluster = issue.duplicateGroupId ? getClusterSummary(issue.duplicateGroupId) : undefined;

  const result: ReportSubmissionResult = {
    issue,
    receipt: issue.receipt,
    cluster,
    analysisEngine: issue.analysisEngine,
    analysisWarning
  };

  return NextResponse.json(result, { status: 201 });
}
