import { NextResponse } from "next/server";
import { getIssue, markFixed } from "@/lib/store";
import { savePhoto, UploadError } from "@/lib/uploads";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const issue = getIssue(id);
  if (issue?.originNodeId) return NextResponse.json({ error: "Update this report on its origin node." }, { status: 409 });
  if (!issue) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  let proofUrl: string | undefined;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const file = (await request.formData()).get("proof");

      if (file instanceof File && file.size > 0) {
        proofUrl = (await savePhoto(file)).publicUrl;
      }
    } else if (contentType.includes("application/json")) {
      const body = await request.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Invalid resolution body");
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof UploadError ? error.message : "Invalid proof upload. Try again." }, { status: 400 });
  }

  return NextResponse.json({ issue: markFixed(id, proofUrl) });
}
