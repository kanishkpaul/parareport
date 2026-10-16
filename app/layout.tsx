import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ParaReport — Civic memory for Kolkata's paras",
    template: "%s · ParaReport"
  },
  description:
    "Turn citizen reports into structured report receipts, department-ready complaint packets, and para-level civic memory for Kolkata."
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f6f2"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            Para<span>Report</span>
          </Link>
          <nav aria-label="Primary">
            <Link href="/">Report</Link>
            <Link href="/issues">Issues</Link>
            <Link href="/dashboard">Dashboard</Link>
          </nav>
        </header>
        {children}
        <footer className="site-footer">
          <p>Hackathon demo · sample records are labeled · use synthetic reports only.</p>
          <p>
            ParaReport generates department-ready civic packets. It does not submit to KMC
            systems and does not claim official complaint status.
          </p>
        </footer>
      </body>
    </html>
  );
}
