import type { Metadata } from "next";
import { ReportFlow } from "@/components/ReportFlow";

export const metadata: Metadata = {
  title: "Report"
};

export default function ReportPage() {
  return (
    <main className="page">
      <div className="page-intro">
        <span className="intro-kicker">Civic reporting prototype</span>
        <h1>Report a civic issue</h1>
        <p>
          One report becomes a structured receipt: suggested severity, risk flags, department hints, a
          Bengali warning, and an English complaint draft - saved to your para&apos;s memory.
        </p>
        <div className="trust-strip" aria-label="System status">
          <span>Multilingual intake</span>
          <span>Optional local / BYOK AI</span>
          <span>Para memory</span>
        </div>
      </div>
      <ReportFlow />
    </main>
  );
}
