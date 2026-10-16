import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CivicReceiptCard } from "@/components/CivicReceiptCard";
import { IssueActions } from "@/components/IssueActions";
import { getClusterSummary, getIssue, listIssues } from "@/lib/store";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const issue = getIssue((await params).id);

  if (!issue) {
    return { title: "Report not found" };
  }

  return {
    title: issue.title,
    description: issue.cleanSummary,
    openGraph: {
      title: `${issue.title} · ParaReport`,
      description: issue.cleanSummary,
      images: issue.photoUrl ? [issue.photoUrl] : undefined
    }
  };
}

export default async function IssuePage({ params }: { params: Params }) {
  const issue = getIssue((await params).id);

  if (!issue) {
    notFound();
  }

  const cluster = issue.duplicateGroupId ? getClusterSummary(issue.duplicateGroupId) : undefined;
  const siblings = issue.duplicateGroupId
    ? listIssues({ groupId: issue.duplicateGroupId }).filter((other) => other.id !== issue.id)
    : [];

  return (
    <main className="page">
      <div className="page-intro">
        <p className="breadcrumb">
          <Link href="/issues">← All issues</Link>
        </p>
        <h1>{issue.title}</h1>
        <p>
          {issue.locationText}
          {issue.ward ? ` · ${issue.ward}` : ""} · reported {formatDate(issue.createdAt)} · status:{" "}
          {issue.status === "verified" ? "reported" : issue.status.replaceAll("_", " ")}
        </p>
      </div>

      {issue.photoUrl ? (
        <Image
          src={issue.photoUrl}
          alt={`Photo evidence for ${issue.title}`}
          width={720}
          height={405}
          className="detail-photo"
          unoptimized
        />
      ) : null}

      <p>{issue.isSeed ? "Sample report · illustrative evidence" : "Prototype report · not independently verified"}{issue.originNodeId ? ` · Synced from ${issue.originNodeId}` : ""}</p>
      <CivicReceiptCard receipt={issue.receipt} issueId={issue.id} />

      <IssueActions issue={issue} />

      {cluster && cluster.reportCount > 1 ? (
        <section className="panel cluster-panel">
          <h2>Para memory for this spot</h2>
          <p>
            {cluster.reportCount} reports here between {formatDate(cluster.firstReportedAt)} and{" "}
            {formatDate(cluster.lastReportedAt)}, with {cluster.unresolvedConfirmations} unresolved
            anonymous demo updates.
          </p>
          <ul className="plain-list">
            {siblings.map((sibling) => (
              <li key={sibling.id}>
                <Link href={`/issues/${sibling.id}`}>{sibling.title}</Link> —{" "}
                {formatDate(sibling.createdAt)} · {sibling.status.replace("_", " ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {issue.fixedProofUrl ? (
        <section className="panel">
          <h2>Marked fixed · unreviewed attachment</h2>
          <Image
            src={issue.fixedProofUrl}
            alt="Attachment submitted with the fixed claim"
            width={720}
            height={405}
            className="detail-photo"
            unoptimized
          />
        </section>
      ) : null}
    </main>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
