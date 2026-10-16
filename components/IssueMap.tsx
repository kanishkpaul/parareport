"use client";

import { useEffect, useRef } from "react";
import type { CivicIssue } from "@/types/civic";
import { getModeConfig } from "@/lib/modes";

const KOLKATA_CENTER: [number, number] = [22.5726, 88.3639];

export function IssueMap({ issues }: { issues: CivicIssue[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    import("leaflet").then((L) => {
      if (cancelled) {
        return;
      }

      map = L.map(container).setView(KOLKATA_CENTER, 12);

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      const located = issues.filter((issue) => issue.lat != null && issue.lng != null);

      for (const issue of located) {
        const color = getModeConfig(issue.mode).primaryColor;
        L.circleMarker([issue.lat!, issue.lng!], {
          radius: issue.severity === "critical" ? 11 : issue.severity === "high" ? 9 : 7,
          color,
          fillColor: color,
          fillOpacity: issue.status === "fixed" ? 0.25 : 0.75,
          weight: 2
        })
          .addTo(map!)
          .bindPopup(
            `<strong>${escapeHtml(issue.title)}</strong><br/>${escapeHtml(issue.locationText)}<br/>` +
              `${escapeHtml(issue.severity)} · ${escapeHtml(issue.status.replaceAll("_", " "))}<br/>` +
              `<a href="/issues/${encodeURIComponent(issue.id)}">View receipt</a>`
          );
      }

      if (located.length) {
        map.fitBounds(
          L.latLngBounds(located.map((issue) => [issue.lat!, issue.lng!] as [number, number])),
          { padding: [30, 30], maxZoom: 15 }
        );
      }
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [issues]);

  return <div ref={containerRef} className="issue-map" aria-label="Map of reported issues" />;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
