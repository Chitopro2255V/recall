"use client";

import { useCallback, useRef, useState } from "react";
import { extractPdfText } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";

type FlashCard = { front: string; back: string; sourcePage: number };
type Phase = "idle" | "extracting" | "generating" | "done" | "error";

export function Uploader() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [cards, setCards] = useState<FlashCard[]>([]);
  const [filename, setFilename] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError("");
    setCards([]);
    setFilename(file.name);

    try {
      // Validation before any work starts
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        throw new Error("That doesn't look like a PDF — please choose a .pdf file.");
      }
      if (file.size > 25 * 1024 * 1024) {
        throw new Error("File is too large (max 25 MB).");
      }

      // 1. Extract text in the browser
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

      // 2. Generate cards (text only — the file itself never leaves your machine)
      setPhase("generating");
      setProgress("Generating flashcards… this usually takes 10–30 seconds. Don't close the tab.");

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pages }),
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
  }, []);

  const busy = phase === "extracting" || phase === "generating";

  // ── Idle / error: the dropzone ──
  if (phase === "idle" || phase === "error") {
    return (
      <div className="mt-8 space-y-4">
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
          className={`flex h-64 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
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
              e.target.value = ""; // allow picking the same file again
            }}
          />
          <span className="text-4xl">📄</span>
          <p className="font-medium">Drag & drop a PDF here</p>
          <p className="text-sm text-muted-foreground">or click to browse — max ~30 pages for v1</p>
        </div>
        {phase === "error" && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    );
  }

  // ── Working ──
  if (busy) {
    return (
      <div className="mt-8 flex h-64 flex-col items-center justify-center gap-3 rounded-xl border p-8 text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <p className="font-medium">{filename}</p>
        <p className="text-sm text-muted-foreground">{progress}</p>
      </div>
    );
  }

  // ── Done: card preview ──
  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-medium">
          {filename} → <span className="text-primary">{cards.length} cards</span>
        </p>
        <Button variant="outline" onClick={() => setPhase("idle")}>
          Generate another
        </Button>
      </div>
      <div className="space-y-3">
        {cards.map((c, i) => (
          <UICard key={i}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">{c.front}</p>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  p. {c.sourcePage}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{c.back}</p>
            </CardContent>
          </UICard>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        Editing and saving to your library comes in the next step — this screen is
        the pipeline proving itself end to end.
      </p>
    </div>
  );
}