import { getDb, issueToRow, rowToIssue, ISSUE_INSERT_SQL } from "@/lib/db";
import type { CivicIssue, IssueStatus, SeasonalModeId } from "@/types/civic";
import type { ClusterCandidate, IssueStore, ListFilters } from "@/lib/storage/types";

const OPEN_STATUSES: IssueStatus[] = ["new", "needs_more_info", "verified", "in_progress", "duplicate"];

// SQLite-backed IssueStore. This is the default backend for local/cloned nodes.
export class LocalSqliteStore implements IssueStore {
  insert(issue: CivicIssue): void {
    getDb().prepare(ISSUE_INSERT_SQL).run(...issueToRow(issue));
  }

  updateAnalysis(issue: CivicIssue): void {
    const previous = this.get(issue.id);
    if (!previous || previous.originNodeId) return;
    getDb().prepare(`UPDATE issues SET title=?, clean_summary=?, mode=?, category=?,
      subcategories=?, severity=?, risk_flags=?, department_suggestions=?, receipt=?,
      analysis_engine=?, updated_at=? WHERE id=?`).run(
      issue.title, issue.cleanSummary, issue.mode, issue.category,
      JSON.stringify(issue.subcategories), issue.severity, JSON.stringify(issue.riskFlags),
      JSON.stringify(issue.departmentSuggestions), JSON.stringify(issue.receipt),
      issue.analysisEngine, new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString(), issue.id
    );
  }

  get(id: string): CivicIssue | undefined {
    const row = getDb().prepare("SELECT * FROM issues WHERE id = ?").get(id) as
      | Record<string, unknown>
      | undefined;

    return row ? rowToIssue(row) : undefined;
  }

  has(id: string): boolean {
    const row = getDb().prepare("SELECT 1 AS present FROM issues WHERE id = ?").get(id) as
      | { present: number }
      | undefined;

    return Boolean(row);
  }

  list(filters: ListFilters): CivicIssue[] {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.mode) {
      where.push("mode = ?");
      params.push(filters.mode);
    }

    if (filters.severity) {
      where.push("severity = ?");
      params.push(filters.severity);
    }

    if (filters.status === "open") {
      where.push(`status IN (${OPEN_STATUSES.map(() => "?").join(",")})`);
      params.push(...OPEN_STATUSES);
    } else if (filters.status) {
      where.push("status = ?");
      params.push(filters.status);
    }

    if (filters.groupId) {
      where.push("duplicate_group_id = ?");
      params.push(filters.groupId);
    }

    const sql = `SELECT * FROM issues ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY created_at DESC LIMIT ?`;
    params.push(filters.limit ?? 100);

    return (getDb().prepare(sql).all(...params) as Record<string, unknown>[]).map(rowToIssue);
  }

  incrementUnresolved(id: string): CivicIssue | undefined {
    const previous = this.get(id);
    if (!previous || previous.originNodeId) return undefined;
    const now = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    getDb()
      .prepare(
        `UPDATE issues SET
          unresolved_confirmations = unresolved_confirmations + 1,
          updated_at = ?
        WHERE id = ?`
      )
      .run(now, id);

    return this.get(id);
  }

  markFixed(id: string, proofUrl?: string): CivicIssue | undefined {
    const previous = this.get(id);
    if (!previous || previous.originNodeId) return undefined;
    const now = new Date(Math.max(Date.now(), Date.parse(previous.updatedAt) + 1)).toISOString();
    getDb()
      .prepare(
        "UPDATE issues SET status = 'fixed', fixed_proof_url = COALESCE(?, fixed_proof_url), updated_at = ? WHERE id = ?"
      )
      .run(proofUrl ?? null, now, id);

    return this.get(id);
  }

  clusterCandidates(mode: SeasonalModeId, limit: number): ClusterCandidate[] {
    const rows = getDb()
      .prepare(
        "SELECT location_text, duplicate_group_id, lat, lng FROM issues WHERE mode = ? AND duplicate_group_id IS NOT NULL ORDER BY created_at DESC LIMIT ?"
      )
      .all(mode, limit) as Array<{
      location_text: string;
      duplicate_group_id: string;
      lat: number | null;
      lng: number | null;
    }>;

    return rows.map((row) => ({
      locationText: row.location_text,
      groupId: row.duplicate_group_id,
      lat: row.lat ?? undefined,
      lng: row.lng ?? undefined
    }));
  }

  localIssuesSince(cursor: string | undefined, limit: number): Array<{ issue: CivicIssue; sequence: number }> {
    if (cursor && !/^s:\d+$/.test(cursor)) throw new Error("Invalid federation cursor; reset the peer cursor.");
    const sequence = cursor ? Number(cursor.slice(2)) : 0;
    const rows = getDb().prepare(`
      SELECT issues.*, changes.sequence FROM issues JOIN
        (SELECT issue_id, MAX(sequence) AS sequence FROM federation_changes GROUP BY issue_id) changes
      ON issues.id = changes.issue_id
      WHERE changes.sequence > ? AND issues.origin_node_id IS NULL AND issues.is_seed = 0
      ORDER BY changes.sequence LIMIT ?
    `).all(sequence, limit) as Array<Record<string, unknown>>;
    return rows.map(row => ({ issue: rowToIssue(row), sequence: row.sequence as number }));
  }

  upsertRemote(issue: CivicIssue): boolean {
    const result = getDb()
      .prepare(`${ISSUE_INSERT_SQL} ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, clean_summary=excluded.clean_summary, mode=excluded.mode,
        category=excluded.category, severity=excluded.severity, status=excluded.status,
        risk_flags=excluded.risk_flags, department_suggestions=excluded.department_suggestions,
        location_text=excluded.location_text, landmark=excluded.landmark, ward=excluded.ward,
        borough=excluded.borough, lat=excluded.lat, lng=excluded.lng,
        verification_count=excluded.verification_count, unresolved_confirmations=excluded.unresolved_confirmations,
        receipt=excluded.receipt, updated_at=excluded.updated_at, signature=excluded.signature,
        analysis_engine=excluded.analysis_engine, federated_at=excluded.federated_at,
        raw_text=excluded.raw_text
        WHERE issues.origin_node_id = excluded.origin_node_id AND excluded.updated_at > issues.updated_at`)
      .run(...issueToRow(issue));

    return Number(result.changes) > 0;
  }

  countByOrigin(kind: "local" | "remote"): number {
    const clause = kind === "local" ? "origin_node_id IS NULL AND is_seed = 0" : "origin_node_id IS NOT NULL";
    const row = getDb().prepare(`SELECT COUNT(*) AS n FROM issues WHERE ${clause}`).get() as {
      n: number;
    };

    return row.n;
  }

  getPeerCursor(peerUrl: string): string | undefined {
    const row = getDb().prepare("SELECT cursor FROM federation_cursors WHERE peer_url = ?").get(peerUrl) as
      | { cursor: string | null }
      | undefined;

    return row?.cursor ?? undefined;
  }

  setPeerCursor(peerUrl: string, cursor: string): void {
    getDb()
      .prepare(
        `INSERT INTO federation_cursors (peer_url, cursor, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(peer_url) DO UPDATE SET cursor = excluded.cursor, updated_at = excluded.updated_at`
      )
      .run(peerUrl, cursor, new Date().toISOString());
  }
}
