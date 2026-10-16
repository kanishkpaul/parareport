"use client";

import { useState } from "react";
import type { CivicReceipt } from "@/types/civic";
import { getModeConfig, modeColorStyle } from "@/lib/modes";
import { RiskFlagList } from "@/components/RiskFlagList";
import { SeverityBadge } from "@/components/SeverityBadge";

type CivicReceiptCardProps = {
  receipt: CivicReceipt;
  issueId: string;
};

export function CivicReceiptCard({ receipt, issueId }: CivicReceiptCardProps) {
  const mode = getModeConfig(receipt.mode);

  return (
    <article className="receipt" style={modeColorStyle(receipt.mode)}>
      <div className="receipt-header">
        <div>
          <span className="receipt-kicker">Civic receipt</span>
          <h2>{receipt.publicTitle}</h2>
        </div>
        <div className="receipt-meta">
          <span className="mode-tag">{mode.shortName}</span>
          <SeverityBadge severity={receipt.severity} />
        </div>
      </div>

      <p className="receipt-summary">{receipt.evidenceSummary}</p>

      {receipt.publicSafetyWarning ? (
        <div className="warning-card">
          <strong>Public warning</strong>
          <p>{receipt.publicSafetyWarning}</p>
        </div>
      ) : null}

      <div className="receipt-signal-row">
        <div className="receipt-signal">
          <h3>Risk flags</h3>
          <RiskFlagList flags={receipt.riskFlags} />
        </div>
        <div className="receipt-signal">
          <h3>Departments</h3>
          <ul className="plain-list">
            {receipt.departmentSuggestions.map((department) => (
              <li key={department}>{department}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="receipt-actions-panel">
        <ActionList title="Citizen safe actions" actions={receipt.citizenSafeActions} />
        <ActionList title="Volunteer / club checklist" actions={receipt.volunteerActions} />
      </div>

      <TextPacket label="Authority packet draft · placeholder" text={receipt.officialEnglishComplaint} />
      <TextPacket label="Bengali share text" text={receipt.bengaliShareText} whatsapp />
      {receipt.hindiShareText ? (
        <TextPacket label="Hindi share text" text={receipt.hindiShareText} whatsapp />
      ) : null}

      <p>Authority submission is a placeholder. Nothing is sent or tracked.</p>
      <p>Classification and language output are suggestions; photos are attachments only.</p>
      <ShareRow issueId={issueId} />
    </article>
  );
}

function ActionList({ title, actions }: { title: string; actions: string[] }) {
  return (
    <div>
      <h3>{title}</h3>
      <ul className="plain-list">
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
    </div>
  );
}

function TextPacket({ label, text, whatsapp }: { label: string; text: string; whatsapp?: boolean }) {
  return (
    <details className="text-packet">
      <summary>{label}</summary>
      <p>{text}</p>
      <div className="packet-actions">
        <CopyButton text={text} />
        {whatsapp ? (
          <a
            className="quiet-action"
            href={`https://wa.me/?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Share on WhatsApp
          </a>
        ) : null}
      </div>
    </details>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text); setCopied(true); setError(false);
      window.setTimeout(() => setCopied(false), 1500);
    } catch { setError(true); }
  }

  return (
    <button type="button" className="quiet-action" onClick={copy}>
      {error ? "Copy unavailable · select text above" : copied ? "Copied" : "Copy"}
    </button>
  );
}

function ShareRow({ issueId }: { issueId: string }) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/issues/${encodeURIComponent(issueId)}`);
      setCopied(true); setError(false); window.setTimeout(() => setCopied(false), 1500);
    } catch { setError(true); }
  }

  return (
    <div className="share-row">
      <button type="button" className="quiet-action" onClick={copyLink}>
        {error ? "Copy unavailable · use the address bar" : copied ? "Link copied" : "Copy public link"}
      </button>
    </div>
  );
}
