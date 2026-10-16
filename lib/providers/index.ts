import type { AnalyzeIssueInput } from "@/types/civic";
import { analyzeIssue } from "@/lib/analyzer";
import { callOpenAICompatible } from "@/lib/providers/openaiCompatible";
import type { AnalysisResult, ByokConfig, PhotoHint } from "@/lib/providers/types";

const GEMMA_MODEL = process.env.GEMMA_MODEL || "gemma-4-e2b-it";
const GEMMA_BASE_URL = (process.env.GEMMA_BASE_URL || "http://127.0.0.1:8081/v1").replace(/\/$/, "");

export type AnalyzeOptions = {
  photo?: PhotoHint;
  byok?: ByokConfig;
};

// Selects the analysis engine per request and always resolves to a valid
// result. Selection order:
//   1. BYOK, when the visitor supplied an OpenAI-compatible endpoint + key.
//   2. Local Gemma, when GEMMA_ENABLED=true.
//   3. Deterministic rules engine (also the fallback when 1 or 2 fail).
export async function analyzeReport(
  input: AnalyzeIssueInput,
  options: AnalyzeOptions = {}
): Promise<AnalysisResult> {
  if (options.byok) {
    const output = await callOpenAICompatible({
      baseUrl: options.byok.baseUrl,
      model: options.byok.model,
      apiKey: options.byok.apiKey,
      input,
      photo: options.photo
    });

    if (output) {
      return { output, engine: "byok" };
    }

    // BYOK failed: fall back to rules rather than silently using the local
    // model, so the visitor's explicit choice is respected.
    return { output: analyzeIssue(input), engine: "rules" };
  }

  const localEnabled = process.env.GEMMA_ENABLED === "true";

  if (localEnabled) {
    const output = await callOpenAICompatible({
      baseUrl: GEMMA_BASE_URL,
      model: GEMMA_MODEL,
      input,
      photo: options.photo
    });

    if (output) {
      return { output, engine: "local-gemma" };
    }
  }

  return { output: analyzeIssue(input), engine: "rules" };
}

export type { AnalysisResult, ByokConfig, PhotoHint } from "@/lib/providers/types";
export { readByokConfig, BYOK_HEADERS } from "@/lib/providers/byok";
