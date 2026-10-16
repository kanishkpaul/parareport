"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CivicIssue } from "@/types/civic";

export function IssueActions({ issue }: { issue: CivicIssue }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proof, setProof] = useState<File | null>(null);

  if (issue.status === "fixed" || issue.originNodeId) {
    return null;
  }

  async function confirmUnresolved() {
    setIsPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(issue.id)}/confirm`, { method: "POST" });
      if (!response.ok) throw new Error("Could not save the update. Try again.");
      router.refresh();
    } catch { setError("Could not save the update. Check the connection and try again."); }
    finally { setIsPending(false); }
  }

  async function markFixed() {
    setIsPending(true);
    setError(null);
    const form = new FormData();

    if (proof) {
      form.set("proof", proof);
    }

    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(issue.id)}/resolve`, { method: "POST", body: form });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Could not update the report.");
      }
      router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update the report. Try again."); }
    finally { setIsPending(false); }
  }

  return (
    <section className="panel issue-actions" aria-label="Update this report">
      <h2>Demo status updates</h2>
      <p>Anonymous updates are not independent verification.</p>
      <div className="action-row">
        <button type="button" className="primary-action" onClick={confirmUnresolved} disabled={isPending}>
          Record unresolved (demo)
        </button>
        <label className="field-label proof-field">
          Proof photo (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={(event) => setProof(event.target.files?.[0] ?? null)}
          />
        </label>
        <button type="button" className="quiet-action" onClick={markFixed} disabled={isPending}>
          Mark fixed (unreviewed)
        </button>
      </div>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}
