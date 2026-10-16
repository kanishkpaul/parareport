import type { ReceiptEnvelope } from "@/types/civic";

const MODES = new Set(["everyday", "summer_heat_water", "pre_monsoon_storm_prep", "monsoon_flood_dengue", "pujo_safety", "post_pujo_cleanup", "winter_air_dust", "wetlands_watch"]);
const SEVERITIES = new Set(["low", "medium", "high", "critical"]);
const STATUSES = new Set(["new", "needs_more_info", "verified", "in_progress", "fixed", "duplicate", "archived"]);
const member = (value: unknown, allowed: Set<string>): boolean => typeof value === "string" && allowed.has(value);
const text = (value: unknown): value is string => typeof value === "string" && value.length <= 20000;
const timestamp = (value: unknown): boolean => text(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
const strings = (value: unknown): boolean => Array.isArray(value) && value.length <= 50 && value.every(text);
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

export function validEnvelope(value: unknown): value is ReceiptEnvelope {
  if (!record(value) || value.version !== 1 || !text(value.originNodeId) || !value.originNodeId.trim() || value.originNodeId.length > 128 ||
      !timestamp(value.emittedAt) || typeof value.signature !== "string" || !/^[a-f0-9]{64}$/.test(value.signature)) return false;
  const p = value.payload;
  if (!record(p) || !text(p.originIssueId) || !p.originIssueId || p.originIssueId.length > 128 ||
      !timestamp(p.createdAt) || !timestamp(p.updatedAt) || String(p.updatedAt) < String(p.createdAt) ||
      !member(p.mode, MODES) || !member(p.severity, SEVERITIES) || !member(p.status, STATUSES) ||
      !text(p.category) || !text(p.locationText) ||
      !member(p.analysisEngine, new Set(["rules", "local-gemma", "byok"]))) return false;
  for (const key of ["verificationCount", "unresolvedConfirmations"]) {
    if (!Number.isSafeInteger(p[key]) || Number(p[key]) < 0) return false;
  }
  for (const key of ["landmark", "ward", "borough"]) if (p[key] !== undefined && !text(p[key])) return false;
  if ((p.lat === undefined) !== (p.lng === undefined)) return false;
  if (p.lat !== undefined && (typeof p.lat !== "number" || !Number.isFinite(p.lat) || Math.abs(p.lat) > 90 ||
      typeof p.lng !== "number" || !Number.isFinite(p.lng) || Math.abs(p.lng) > 180)) return false;
  const r = p.receipt;
  if (!record(r) || r.mode !== p.mode || r.severity !== p.severity) return false;
  for (const key of ["issueId", "publicTitle", "evidenceSummary", "officialEnglishComplaint", "bengaliShareText"]) if (!text(r[key])) return false;
  for (const key of ["hindiShareText", "publicSafetyWarning"]) if (r[key] !== undefined && !text(r[key])) return false;
  for (const key of ["riskFlags", "departmentSuggestions", "citizenSafeActions", "volunteerActions"]) if (!strings(r[key])) return false;
  return JSON.stringify(value).length <= 200000;
}
