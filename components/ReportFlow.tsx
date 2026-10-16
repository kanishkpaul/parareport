"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReportSubmissionResult, SeasonalModeId } from "@/types/civic";
import { CivicReceiptCard } from "@/components/CivicReceiptCard";
import { ModeSwitcher } from "@/components/ModeSwitcher";
import { ReportForm } from "@/components/ReportForm";
import { ByokSettings } from "@/components/ByokSettings";
import { getDefaultMode } from "@/lib/modes";
import { engineLabel } from "@/lib/engineLabels";
import { byokHeaders, loadByokConfig, type ByokClientConfig } from "@/lib/byokClient";

export function ReportFlow() {
  const defaultMode = useMemo(() => getDefaultMode(new Date()), []);
  const [selectedMode, setSelectedMode] = useState<SeasonalModeId>(defaultMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportSubmissionResult | null>(null);
  const [byok, setByok] = useState<ByokClientConfig | null>(null);

  // Read after mount, not in a lazy initializer: sessionStorage is unavailable
  // during SSR, and reading it at render time would cause a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setByok(loadByokConfig());
  }, []);

  async function handleSubmit(form: FormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        body: form,
        headers: byokHeaders(byok)
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error || "Something went wrong. Please try again.");
        return;
      }

      setResult(body as ReportSubmissionResult);
      setError((body as ReportSubmissionResult).analysisWarning ?? null);
      setSelectedMode((body as ReportSubmissionResult).issue.mode);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="report-flow">
      <section className="panel">
        <ModeSwitcher value={selectedMode} onChange={setSelectedMode} />
        <ReportForm
          selectedMode={selectedMode}
          onModeChange={setSelectedMode}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <ByokSettings key={byok ? JSON.stringify([byok.baseUrl, byok.model]) : "off"} value={byok} onChange={setByok} />
      </section>

      {result ? (
        <section className="result-stack" aria-label="Generated civic receipt">
          <div className="result-meta">
            <p>
              Saved as <Link href={`/issues/${result.issue.id}`}>{result.issue.id}</Link> ·
              analyzed by {engineLabel(result.analysisEngine)}
            </p>
            {result.cluster && result.cluster.reportCount > 1 ? (
              <p className="cluster-note">
                This location already has {result.cluster.reportCount} reports since{" "}
                {formatDate(result.cluster.firstReportedAt)} —{" "}
                <Link href={`/issues?groupId=${result.cluster.groupId}`}>view the cluster</Link>.
              </p>
            ) : null}
          </div>
          <CivicReceiptCard receipt={result.receipt} issueId={result.issue.id} />
        </section>
      ) : null}
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
