import type { Metadata } from "next";
import { IssueCard } from "@/components/IssueCard";
import { IssueMap } from "@/components/IssueMap";
import { seasonalModes } from "@/lib/modes";
import { listIssues } from "@/lib/store";
import type { IssueStatus, SeasonalModeId, Severity } from "@/types/civic";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Issues"
};

type SearchParams = Promise<{
  mode?: string;
  severity?: string;
  status?: string;
  groupId?: string;
}>;

export default async function IssuesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const issues = listIssues({
    mode: (params.mode as SeasonalModeId) || undefined,
    severity: (params.severity as Severity) || undefined,
    status: (params.status as IssueStatus | "open") || undefined,
    groupId: params.groupId || undefined
  });

  return (
    <main className="page wide">
      <div className="page-intro">
        <h1>Para issues</h1>
        <p>
          {issues.length} report{issues.length === 1 ? "" : "s"}
          {params.groupId ? " in this cluster" : " across Kolkata paras"} — every one backed by a
          civic receipt.
        </p>
      </div>

      <form className="filter-bar" method="get" aria-label="Filter issues">
        {params.groupId ? <input type="hidden" name="groupId" value={params.groupId} /> : null}
        <label>
          Mode
          <select name="mode" defaultValue={params.mode || ""}>
            <option value="">All modes</option>
            {seasonalModes.map((mode) => (
              <option key={mode.id} value={mode.id}>
                {mode.shortName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select name="severity" defaultValue={params.severity || ""}>
            <option value="">Any severity</option>
            {["critical", "high", "medium", "low"].map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select name="status" defaultValue={params.status || ""}>
            <option value="">Any status</option>
            <option value="open">Open</option>
            <option value="new">New</option>
            <option value="verified">Reported (legacy)</option>
            <option value="in_progress">In progress</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
        <button type="submit" className="quiet-action">
          Apply
        </button>
      </form>

      <p>Sample reports have illustrative map pins. New reports keep their written location without guessed coordinates.</p>
      <IssueMap issues={issues} />

      <div className="issue-grid">
        {issues.map((issue) => (
          <IssueCard key={issue.id} issue={issue} />
        ))}
        {issues.length === 0 ? <p className="empty-note">No reports match these filters yet.</p> : null}
      </div>
    </main>
  );
}
