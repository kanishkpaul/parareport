import type {
  CivicIssue,
  IssueStatus,
  SeasonalModeId,
  Severity
} from "@/types/civic";

export type ListFilters = {
  mode?: SeasonalModeId;
  severity?: Severity;
  status?: IssueStatus | "open";
  groupId?: string;
  limit?: number;
};

export type ClusterCandidate = {
  locationText: string;
  groupId: string;
  lat?: number;
  lng?: number;
};

// Persistence boundary for civic issues. The `local` implementation is
// SQLite-backed (the default for cloned/local nodes); a `hosted` implementation
// (Postgres-compatible) can be swapped in behind PARAREPORT_STORAGE without the
// business logic in lib/store.ts changing. All methods are synchronous today
// because the local backend is node:sqlite; that keeps the call sites simple.
export interface IssueStore {
  insert(issue: CivicIssue): void;
  updateAnalysis(issue: CivicIssue): void;
  get(id: string): CivicIssue | undefined;
  has(id: string): boolean;
  list(filters: ListFilters): CivicIssue[];

  // Records an anonymous unresolved update without changing verification. Returns the
  // updated issue, or undefined if the id is unknown.
  incrementUnresolved(id: string): CivicIssue | undefined;
  markFixed(id: string, proofUrl?: string): CivicIssue | undefined;

  // Recent issues in a mode that carry a duplicate group id, for clustering.
  clusterCandidates(mode: SeasonalModeId, limit: number): ClusterCandidate[];

  // --- federation ---------------------------------------------------------

  // Sequence bookmarks include new reports and later local changes, excluding samples.
  localIssuesSince(cursor: string | undefined, limit: number): Array<{ issue: CivicIssue; sequence: number }>;

  // Inserts new origin snapshots or applies newer ones; returns whether storage changed.
  upsertRemote(issue: CivicIssue): boolean;

  countByOrigin(kind: "local" | "remote"): number;

  getPeerCursor(peerUrl: string): string | undefined;
  setPeerCursor(peerUrl: string, cursor: string): void;
}
