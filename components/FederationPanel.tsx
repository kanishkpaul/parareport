"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FederationPeerStatus, FederationStatus } from "@/types/civic";

export function FederationPanel() {
  const router = useRouter();
  const [status, setStatus] = useState<FederationStatus | null>(null);
  const [peers, setPeers] = useState<FederationPeerStatus[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh(sync: boolean) {
    setPending(true); setError(null);
    try {
      if (sync) {
        const response = await fetch("/api/federation/sync", { method: "POST" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not sync peers.");
        setPeers(body.peers);
      }
      const response = await fetch("/api/federation/status");
      if (!response.ok) throw new Error("Could not read node status.");
      setStatus(await response.json());
      if (sync) router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Node unavailable. Try again."); }
    finally { setPending(false); }
  }

  return <section className="panel" aria-label="Federation demo">
    <h2>Federation demo</h2>
    <p>Exchange signed receipt snapshots between trusted nodes. Sample reports and photos stay on this node.</p>
    <div className="action-row">
      <button className="quiet-action" disabled={pending} onClick={() => refresh(false)}>Check node</button>
      <button className="quiet-action" disabled={pending} onClick={() => refresh(true)}>{pending ? "Contacting nodes…" : "Sync peers"}</button>
    </div>
    {status ? <p>{status.nodeId} · {status.signingConfigured ? "Signing configured" : "Federation not configured"} · {status.peers.length} peers · {status.localReceipts} local / {status.remoteReceipts} remote receipts</p> : null}
    <ul className="plain-list" aria-live="polite">{peers.map(peer => <li key={peer.url}>{peer.url} · {peer.reachable ? `${peer.imported} new or updated receipts` : "Unavailable"}{peer.error ? ` · ${peer.error}` : ""}</li>)}</ul>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <p>Shared-secret prototype: signatures do not verify facts or establish independent peer identity.</p>
  </section>;
}
