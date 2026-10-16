import type { Metadata } from "next";
import Link from "next/link";
import { FederationPanel } from "@/components/FederationPanel";
import { SeverityBadge } from "@/components/SeverityBadge";
import { getModeConfig } from "@/lib/modes";
import { getDashboardStats } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ward dashboard"
};

export default function DashboardPage() {
  const stats = getDashboardStats();

  return (
    <main className="page wide">
      <div className="page-intro">
        <h1>Ward dashboard</h1>
        <p>Demo database counts include labeled sample reports. Status changes are unreviewed.</p>
      </div>

      <div className="stat-grid">
        <Stat label="Open issues" value={stats.openIssues} />
        <Stat label="Critical open" value={stats.criticalOpen} />
        <Stat label="Reports (7 days)" value={stats.reportsLast7Days} />
        <Stat label="Fixed" value={stats.fixedIssues} />
      </div>

      <FederationPanel />

      <section className="panel">
        <h2>Recurring hotspots</h2>
        {stats.topClusters.length ? (
          <ul className="cluster-list">
            {stats.topClusters.map((cluster) => (
              <li key={cluster.groupId}>
                <div>
                  <Link href={`/issues?groupId=${cluster.groupId}`}>{cluster.title}</Link>
                  <span className="issue-location">{cluster.locationText}</span>
                </div>
                <div className="cluster-counts">
                  <SeverityBadge severity={cluster.severity} />
                  <strong>{cluster.reportCount} reports</strong>
                  <span>{cluster.unresolvedConfirmations} unresolved anonymous updates</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-note">No location has more than one open report yet.</p>
        )}
      </section>

      <section className="panel">
        <h2>Open issues by mode</h2>
        <ul className="mode-count-list">
          {stats.byMode
            .filter((entry) => entry.total > 0)
            .sort((a, b) => b.open - a.open)
            .map((entry) => (
              <li key={entry.mode}>
                <Link href={`/issues?mode=${entry.mode}&status=open`}>
                  {getModeConfig(entry.mode).shortName}
                </Link>
                <span>
                  {entry.open} open / {entry.total} total
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Unresolved update counts (demo)</h2>
        <ul className="plain-list">
          {stats.topUnresolved.map((issue) => (
            <li key={issue.id}>
              <Link href={`/issues/${issue.id}`}>{issue.title}</Link> — {issue.locationText} ·{" "}
              {issue.unresolvedConfirmations} anonymous updates
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <article className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}
