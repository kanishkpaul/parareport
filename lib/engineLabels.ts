import type { AnalysisEngine } from "@/types/civic";

// Human-readable label for the engine that produced an analysis. Shown on
// receipts and issue pages so citizens can see which engine ran.
export function engineLabel(engine: AnalysisEngine): string {
  switch (engine) {
    case "local-gemma":
      return "local model";
    case "byok":
      return "your own model (BYOK)";
    case "rules":
    default:
      return "the rules engine";
  }
}
