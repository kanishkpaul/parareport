import type { CivicIssue, FederatedIssuePayload, ReceiptEnvelope } from "@/types/civic";

// Builds the signed payload from a locally-authored issue. Deliberately omits
// raw report text, photo URLs, and any request-time data so nothing sensitive
// (and no BYOK material) leaves the node — only the public civic receipt and the
// structured metadata a peer needs to render and cluster the issue.
export function issueToPayload(issue: CivicIssue): FederatedIssuePayload {
  return {
    originIssueId: issue.id,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    mode: issue.mode,
    category: issue.category,
    severity: issue.severity,
    status: issue.status,
    locationText: issue.locationText,
    landmark: issue.landmark,
    ward: issue.ward,
    borough: issue.borough,
    lat: issue.lat,
    lng: issue.lng,
    verificationCount: issue.verificationCount,
    unresolvedConfirmations: issue.unresolvedConfirmations,
    analysisEngine: issue.analysisEngine,
    receipt: issue.receipt
  };
}

// Deterministic local id for an imported remote issue, so re-importing the same
// receipt is a no-op (dedupe by primary key). Namespaced by origin node id to
// avoid collisions between peers that reuse issue ids.
export function remoteIssueId(originNodeId: string, originIssueId: string): string {
  return `fed:${encodeURIComponent(originNodeId)}:${encodeURIComponent(originIssueId)}`;
}

// Reconstructs a CivicIssue from a verified envelope, marked as remote-origin.
export function envelopeToIssue(envelope: ReceiptEnvelope): CivicIssue {
  const { payload, originNodeId, signature } = envelope;
  const id = remoteIssueId(originNodeId, payload.originIssueId);

  return {
    id,
    title: payload.receipt.publicTitle,
    // Remote nodes never share raw text; reuse the public evidence summary.
    rawText: payload.receipt.evidenceSummary,
    cleanSummary: payload.receipt.evidenceSummary,
    mode: payload.mode,
    category: payload.category,
    subcategories: [],
    severity: payload.severity,
    riskFlags: payload.receipt.riskFlags,
    departmentSuggestions: payload.receipt.departmentSuggestions,
    locationText: payload.locationText,
    landmark: payload.landmark,
    ward: payload.ward,
    borough: payload.borough,
    lat: payload.lat,
    lng: payload.lng,
    status: payload.status,
    photoUrl: undefined,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    duplicateGroupId: undefined,
    verificationCount: payload.verificationCount,
    unresolvedConfirmations: payload.unresolvedConfirmations,
    fixedProofUrl: undefined,
    receipt: { ...payload.receipt, issueId: id },
    analysisEngine: payload.analysisEngine,
    isSeed: false,
    originNodeId,
    originIssueId: payload.originIssueId,
    federatedAt: new Date().toISOString(),
    signature
  };
}
