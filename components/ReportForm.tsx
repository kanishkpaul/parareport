"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { DemoScenario, SeasonalModeId } from "@/types/civic";
import { demoScenarios } from "@/lib/demoScenarios";
import { getModeConfig } from "@/lib/modes";

type ReportFormProps = {
  selectedMode: SeasonalModeId;
  onModeChange: (mode: SeasonalModeId) => void;
  onSubmit: (form: FormData) => Promise<void>;
  isSubmitting: boolean;
};

export function ReportForm({ selectedMode, onModeChange, onSubmit, isSubmitting }: ReportFormProps) {
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const form = new FormData();
    form.set("text", text);
    form.set("location", location);
    form.set("mode", selectedMode);

    if (photo) {
      form.set("photo", photo);
    }

    await onSubmit(form);
  }

  function loadScenario(scenario: DemoScenario) {
    setText(scenario.text);
    setLocation(scenario.location);
    onModeChange(scenario.mode);
  }

  function clear() {
    setText("");
    setLocation("");
    handlePhoto(null);
  }

  function handlePhoto(file: File | null) {
    setPhoto(file);
    setPhotoPreview((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return file ? URL.createObjectURL(file) : null;
    });

    if (!file && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  return (
    <form className="report-form" onSubmit={submit} aria-label="Report civic issue">
      <label className="field-label" htmlFor="report-text">
        What is happening? (Bengali, Hindi, or English)
      </label>
      <textarea
        id="report-text"
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Water is knee deep near the drain. Plastic is blocking it. A light pole is sparking."
        rows={3}
      />

      <div className="field-row">
        <label className="field-label" htmlFor="report-location">
          Location or landmark
          <input
            id="report-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="Behala, near Banamali Naskar Road"
          />
        </label>
        <label className="field-label" htmlFor="photo-upload">
          Photo attachment (not analyzed)
          <input
            id="photo-upload"
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={(event) => handlePhoto(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {photoPreview ? (
        <div className="image-preview">
          <Image src={photoPreview} alt="Photo attached to this report" width={72} height={54} unoptimized />
          <span>{photo?.name}</span>
          <button type="button" className="quiet-action" onClick={() => handlePhoto(null)}>
            Remove
          </button>
        </div>
      ) : null}

      <div className="action-row">
        <button type="submit" className="primary-action" disabled={isSubmitting}>
          {isSubmitting ? "Saving report…" : `Save ${getModeConfig(selectedMode).shortName} report`}
        </button>
        <button type="button" className="quiet-action" onClick={clear}>
          Clear
        </button>
      </div>

      <div className="demo-strip" aria-label="Try an example report">
        <span>Try an example:</span>
        {demoScenarios.map((scenario) => (
          <button type="button" key={scenario.id} onClick={() => loadScenario(scenario)}>
            {scenario.label}
          </button>
        ))}
      </div>
    </form>
  );
}
