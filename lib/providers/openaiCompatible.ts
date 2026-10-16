import type { AnalyzeIssueInput, AnalyzeIssueOutput } from "@/types/civic";
import { analyzeIssue } from "@/lib/analyzer";
import { getGemmaSystemPrompt } from "@/lib/gemmaPrompt";
import type { PhotoHint } from "@/lib/providers/types";

export type OpenAICompatibleCall = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  input: AnalyzeIssueInput;
  photo?: PhotoHint;
  timeoutMs?: number;
};

// Calls any OpenAI-compatible /chat/completions endpoint (local Gemma via
// llama.cpp, or a BYOK provider). Returns a fully-normalized analysis output,
// or `null` on any failure (network, non-2xx, malformed JSON) so the caller can
// fall back to the deterministic rules engine.
export async function callOpenAICompatible(
  call: OpenAICompatibleCall
): Promise<AnalyzeIssueOutput | null> {
  const baseUrl = call.baseUrl.replace(/\/$/, "");
  const photoHint = call.photo
    ? `\nPhoto: a citizen attached a ${call.photo.mimeType} image, but this text model cannot inspect pixels. Use the report text, location, and this attachment hint only.`
    : "";

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (call.apiKey) {
      headers.Authorization = `Bearer ${call.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: call.model,
        messages: [
          { role: "system", content: getGemmaSystemPrompt() },
          { role: "user", content: `Input JSON:\n${JSON.stringify(call.input)}${photoHint}` }
        ],
        temperature: 0.1,
        max_tokens: 1400,
        response_format: { type: "json_object" }
      }),
      signal: AbortSignal.timeout(call.timeoutMs ?? 45_000)
    });

    if (!response.ok) {
      console.error(`Model endpoint error ${response.status}; falling back to rules engine`);
      return null;
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content;

    if (typeof text !== "string") {
      return null;
    }

    const candidate = extractJson(text);

    if (!candidate) {
      return null;
    }

    return normalizeModelOutput(candidate, call.input);
  } catch {
    console.error("Model analysis failed; falling back to rules engine");
    return null;
  }
}

// OpenAI-compatible servers may return fenced or prefixed JSON depending on the
// chat template, so grab the outermost object.
function extractJson(text: string): Partial<AnalyzeIssueOutput> | undefined {
  const match = text.match(/\{[\s\S]*\}/);

  if (!match) {
    return undefined;
  }

  try {
    return JSON.parse(match[0]);
  } catch {
    return undefined;
  }
}

const VALID_MODES = new Set([
  "everyday",
  "summer_heat_water",
  "pre_monsoon_storm_prep",
  "monsoon_flood_dengue",
  "pujo_safety",
  "post_pujo_cleanup",
  "winter_air_dust",
  "wetlands_watch"
]);
const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

// Merges a model's (possibly partial or malformed) JSON over a deterministic
// rules-engine baseline so every field is always valid and populated.
export function normalizeModelOutput(
  candidate: Partial<AnalyzeIssueOutput>,
  input: AnalyzeIssueInput
): AnalyzeIssueOutput {
  const fallback = analyzeIssue(input);

  return {
    mode: VALID_MODES.has(candidate.mode as string) ? candidate.mode! : fallback.mode,
    category: str(candidate.category) || fallback.category,
    subcategories: strArray(candidate.subcategories) ?? fallback.subcategories,
    severity: VALID_SEVERITIES.has(candidate.severity as string)
      ? candidate.severity!
      : fallback.severity,
    riskFlags: strArray(candidate.riskFlags) ?? fallback.riskFlags,
    followUpQuestion: str(candidate.followUpQuestion) || fallback.followUpQuestion,
    departmentSuggestions: strArray(candidate.departmentSuggestions) ?? fallback.departmentSuggestions,
    cleanSummary: str(candidate.cleanSummary) || fallback.cleanSummary,
    officialEnglishComplaint:
      str(candidate.officialEnglishComplaint) || fallback.officialEnglishComplaint,
    bengaliShareText: str(candidate.bengaliShareText) || fallback.bengaliShareText,
    hindiShareText: str(candidate.hindiShareText) || fallback.hindiShareText,
    publicSafetyWarning: str(candidate.publicSafetyWarning) || fallback.publicSafetyWarning,
    volunteerActions: strArray(candidate.volunteerActions) ?? fallback.volunteerActions,
    citizenSafeActions: strArray(candidate.citizenSafeActions) ?? fallback.citizenSafeActions
  };
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return items.length ? items : undefined;
}
