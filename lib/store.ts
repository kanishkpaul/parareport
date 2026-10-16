import { randomUUID } from "node:crypto";
import { getStore } from "@/lib/storage";
import type { ListFilters } from "@/lib/storage";
import type {
  AnalyzeIssueOutput,
  CivicIssue,
  ClusterSummary,
  DashboardStats,
  SeasonalModeId,
  Severity
} from "@/types/civic";
import { createReceipt } from "@/lib/receipts";

export type { ListFilters } from "@/lib/storage";

export function listIssues(filters: ListFilters = {}): CivicIssue[] {
  return getStore().list(filters);
}

export function getIssue(id: string): CivicIssue | undefined {
  return getStore().get(id);
}

export function createIssueFromAnalysis(params: {
  rawText: string;
  analysis: AnalyzeIssueOutput;
  locationText: string;
  landmark?: string;
  photoUrl?: string;
  analysisEngine: CivicIssue["analysisEngine"];
}): CivicIssue {
  const id = `issue-${randomUUID()}`;
  const now = new Date().toISOString();
  const { analysis } = params;

  const issue: CivicIssue = {
    id,
    title: buildTitle(analysis, params.locationText),
    rawText: params.rawText,
    cleanSummary: analysis.cleanSummary,
    mode: analysis.mode,
    category: analysis.category,
    subcategories: analysis.subcategories,
    severity: analysis.severity,
    riskFlags: analysis.riskFlags,
    departmentSuggestions: analysis.departmentSuggestions,
    locationText: params.locationText,
    landmark: params.landmark,
    status: "new",
    photoUrl: params.photoUrl,
    createdAt: now,
    updatedAt: now,
    duplicateGroupId: newGroupId(params.locationText, analysis.mode),
    verificationCount: 0,
    unresolvedConfirmations: 0,
    receipt: createReceipt(id, analysis),
    analysisEngine: params.analysisEngine,
    isSeed: false
  };

  getStore().insert(issue);

  return issue;
}

export function confirmUnresolved(id: string): CivicIssue | undefined {
  return getStore().incrementUnresolved(id);
}

export function markFixed(id: string, proofUrl?: string): CivicIssue | undefined {
  return getStore().markFixed(id, proofUrl);
}

// --- clustering -------------------------------------------------------------

const STOP_TOKENS = new Set(["near", "road", "lane", "street", "the", "para", "side", "kolkata"]);

function locationTokens(locationText: string): string[] {
  return locationText
    .toLowerCase()
    .split(/[^a-zঀ-৿]+/)
    .filter((token) => token.length > 3 && !STOP_TOKENS.has(token));
}

export function findClusterMatch(
  locationText: string,
  mode: SeasonalModeId
): { groupId: string; lat?: number; lng?: number } | undefined {
  const tokens = locationTokens(locationText);

  if (!tokens.length) {
    return undefined;
  }

  const candidates = getStore().clusterCandidates(mode, 300);

  for (const candidate of candidates) {
    const candidateTokens = new Set(locationTokens(candidate.locationText));

    if (tokens.some((token) => candidateTokens.has(token))) {
      return {
        groupId: candidate.groupId,
        lat: candidate.lat,
        lng: candidate.lng
      };
    }
  }

  return undefined;
}

function newGroupId(locationText: string, mode: SeasonalModeId) {
  const slug = locationTokens(locationText).slice(0, 2).join("-") || "unlocated";
  return `${slug}-${mode}-${randomUUID().slice(0, 4)}`;
}

export function getClusterSummary(groupId: string): ClusterSummary | undefined {
  const rows = listIssues({ groupId, limit: 500 });

  if (!rows.length) {
    return undefined;
  }

  const lead = rows[rows.length - 1];
  const severityRank: Severity[] = ["low", "medium", "high", "critical"];
  const worst = rows.reduce((acc, issue) =>
    severityRank.indexOf(issue.severity) > severityRank.indexOf(acc.severity) ? issue : acc
  );

  return {
    groupId,
    reportCount: rows.length,
    unresolvedConfirmations: rows.reduce((sum, issue) => sum + issue.unresolvedConfirmations, 0),
    firstReportedAt: lead.createdAt,
    lastReportedAt: rows[0].createdAt,
    locationText: lead.locationText,
    title: lead.title,
    severity: worst.severity,
    mode: lead.mode
  };
}

// --- dashboard --------------------------------------------------------------

export function getDashboardStats(): DashboardStats {
  const all = listIssues({ limit: -1 });
  const open = all.filter((issue) => issue.status !== "fixed" && issue.status !== "archived");
  const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;

  const modeMap = new Map<SeasonalModeId, { open: number; total: number }>();

  for (const issue of all) {
    const entry = modeMap.get(issue.mode) ?? { open: 0, total: 0 };
    entry.total += 1;

    if (issue.status !== "fixed" && issue.status !== "archived") {
      entry.open += 1;
    }

    modeMap.set(issue.mode, entry);
  }

  const groupIds = Array.from(new Set(open.map((issue) => issue.duplicateGroupId).filter(Boolean))) as string[];
  const topClusters = groupIds
    .map((groupId) => getClusterSummary(groupId))
    .filter((cluster): cluster is ClusterSummary => Boolean(cluster && cluster.reportCount > 1))
    .sort((a, b) => b.reportCount - a.reportCount)
    .slice(0, 5);

  return {
    totalIssues: all.length,
    openIssues: open.length,
    criticalOpen: open.filter((issue) => issue.severity === "critical").length,
    fixedIssues: all.filter((issue) => issue.status === "fixed").length,
    reportsLast7Days: all.filter((issue) => new Date(issue.createdAt).getTime() > weekAgo).length,
    byMode: Array.from(modeMap.entries()).map(([mode, counts]) => ({ mode, ...counts })),
    topClusters,
    topUnresolved: open
      .slice()
      .sort((a, b) => b.unresolvedConfirmations - a.unresolvedConfirmations)
      .slice(0, 6)
  };
}

function buildTitle(analysis: AnalyzeIssueOutput, locationText: string) {
  const flag = analysis.riskFlags[0] || analysis.category;
  const place = locationText.split(",")[0]?.trim() || "Kolkata";
  return `${capitalize(flag)} at ${place}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
