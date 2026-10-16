import { ReportFlow } from "@/components/ReportFlow";

export default function Home() {
  return (
    <main className="page">
      <div className="page-intro">
        <h1>Report a civic issue</h1>
        <p>
          One report becomes a structured receipt: suggested severity, risk flags, department hints, a
          Bengali warning, and an English complaint draft — saved to your para&apos;s memory.
        </p>
      </div>
      <ReportFlow />
    </main>
  );
}
