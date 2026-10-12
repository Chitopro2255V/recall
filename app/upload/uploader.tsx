"use client";

import { useCallback, useRef, useState } from "react";
import { extractPdfText } from "@/lib/pdf";
import type { GeneratedCard } from "@/lib/card-types";
import { Button } from "@/components/ui/button";
import { ReviewEditor } from "./review";

type Phase = "idle" | "extracting" | "generating" | "done" | "error";
type Mode = "flashcard" | "quiz" | "tf";

const MODES: { id: Mode; icon: string; label: string; desc: string }[] = [
  { id: "flashcard", icon: "🃏", label: "Flashcards", desc: "Question on one side, answer on the other" },
  { id: "quiz", icon: "📝", label: "Multiple choice", desc: "4 options — pick the right one" },
  { id: "tf", icon: "⚖️", label: "True / False", desc: "Judge each statement" },
];

export function Uploader() {
  const [mode, setMode] = useState<Mode>("flashcard");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setCards([]);
    setFilename(file.name);

    try {
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("That doesn't look like a PDF — please choose a .pdf file.");
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("File is too large (max 25 MB).");
      }

      setPhase("extracting");
      const pages = await extractPdfText(file, (page, total) =>
        setProgress(`Reading page ${page} of ${total}…`)
      );

      const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
      if (totalChars < 200) {
        throw new Error(
          "This PDF has no text layer — it's probably a scan or an image. We can't read those yet (OCR is on the roadmap)."
        );
      }

      setPhase("generating");
      setProgress("Generating… this usually takes 10–30 seconds. Don't close the tab.");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages, mode }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Generation failed.");

      if (!body.cards?.length) {
        throw new Error("Couldn't find enough studyable material — try a more text-heavy PDF.");
      }

      setCards(body.cards);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }, [mode]);

  const busy = phase === "extracting" || phase === "generating";

  if (phase === "idle" || phase === "error") {
    return (
      <div className="mt-8 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium">Choose your study mode</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex flex-col items-start gap-1 rounded-xl border p-4 text-left transition-colors ${
                  mode === m.id ? "border-primary bg-muted" : "border-border hover:border-muted-foreground/40"
                }`}
              >
                <span className="text-2xl">{m.icon}</span>
                <span className="font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          className={`flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
            dragging ? "border-primary bg-muted" : "border-border hover:border-muted-foreground/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = "";
            }}
          />
          <span className="text-4xl">📄</span>
          <p className="font-medium">Drag & drop a PDF here</p>
          <p className="text-sm text-muted-foreground">or click to browse — max ~22 pages for v1</p>
        </div>
        {phase === "error" && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (busy) {
    return (
      <div className="mt-8 flex h-56 flex-col items-center justify-center gap-3 rounded-xl border p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="font-medium">{filename}</p>
        <p className="text-sm text-muted-foreground">{progress}</p>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filename}</span> →{" "}
          {cards.length} items generated
        </p>
        <Button variant="outline" size="sm" onClick={() => setPhase("idle")}>
          Start over
        </Button>
      </div>
      <ReviewEditor initialCards={cards} sourceFilename={filename} />
    </div>
  );
}