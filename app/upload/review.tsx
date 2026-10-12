"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card as UICard, CardContent } from "@/components/ui/card";
import type { GeneratedCard } from "@/lib/card-types";

export function ReviewEditor({
  initialCards,
  sourceFilename,
}: {
  initialCards: GeneratedCard[];
  sourceFilename: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(
    sourceFilename.replace(/\.pdf$/i, "") || "Untitled deck"
  );
  const [cards, setCards] = useState<GeneratedCard[]>(initialCards);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (i: number, field: "front" | "back", value: string) =>
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const updateOption = (i: number, oi: number, value: string) =>
    setCards((prev) =>
      prev.map((c, idx) =>
        idx === i && c.options ? { ...c, options: c.options.map((o, j) => (j === oi ? value : o)) } : c
      )
    );

  const setCorrect = (i: number, oi: number) =>
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, correctIndex: oi } : c)));

  const remove = (i: number) => setCards((prev) => prev.filter((_, idx) => idx !== i));

  const isValid = (c: GeneratedCard) => {
    if (c.type === "basic") return Boolean(c.front.trim() && c.back.trim());
    if (c.type === "tf") return Boolean(c.front.trim());
    return (
      Boolean(c.front.trim()) &&
      (c.options?.length ?? 0) >= 2 &&
      c.options!.every((o) => o.trim().length > 0)
    );
  };

  const validCount = cards.filter(isValid).length;

  const save = async () => {
    setError("");
    if (!title.trim()) return setError("Give your deck a title.");
    if (validCount === 0) return setError("Keep at least one complete card.");

    setSaving(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceFilename,
          cards: cards.filter(isValid).map((c) => {
            if (c.type === "basic") {
              return { type: c.type, front: c.front.trim(), back: c.back.trim(), sourcePage: c.sourcePage };
            }
            // back is DERIVED for quiz cards — never trust a stale copy
            const back = c.type === "tf" ? (c.correctIndex === 0 ? "True" : "False") : c.options![c.correctIndex!];
            return {
              type: c.type,
              front: c.front.trim(),
              back,
              options: c.options!.map((o) => o.trim()),
              correctIndex: c.correctIndex!,
              sourcePage: c.sourcePage,
            };
          }),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Saving failed.");
      router.push("/decks");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Deck title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
      </div>
      <p className="text-sm text-muted-foreground">
        {cards.length} items — fix anything the AI got wrong, delete the junk. Nothing is stored
        until you hit Save.
      </p>
      <div className="space-y-3">
        {cards.map((c, i) => (
          <UICard key={i}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {c.type === "mc" ? "Question" : c.type === "tf" ? "Statement" : "Card"} {i + 1} · p. {c.sourcePage}
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove(i)}>Delete</Button>
              </div>

              <Input
                value={c.front}
                onChange={(e) => update(i, "front", e.target.value)}
                placeholder={c.type === "basic" ? "Front (question)" : c.type === "tf" ? "Statement" : "Question"}
                maxLength={300}
              />

              {c.type === "basic" && (
                <Textarea
                  value={c.back}
                  onChange={(e) => update(i, "back", e.target.value)}
                  placeholder="Back (answer)"
                  maxLength={1000}
                  rows={3}
                />
              )}

              {c.type === "mc" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select the correct answer:</p>
                  {c.options?.map((opt, oi) => (
                    <label key={oi} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`correct-${i}`}
                        checked={c.correctIndex === oi}
                        onChange={() => setCorrect(i, oi)}
                      />
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(i, oi, e.target.value)}
                        placeholder={`Option ${oi + 1}`}
                        maxLength={300}
                      />
                      {c.correctIndex === oi && <Badge variant="secondary">correct</Badge>}
                    </label>
                  ))}
                </div>
              )}

              {c.type === "tf" && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Answer:</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={c.correctIndex === 0 ? "default" : "outline"}
                    onClick={() => setCorrect(i, 0)}
                  >
                    True
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={c.correctIndex === 1 ? "default" : "outline"}
                    onClick={() => setCorrect(i, 1)}
                  >
                    False
                  </Button>
                </div>
              )}
            </CardContent>
          </UICard>
        ))}
      </div>
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? "Saving…" : `Save deck (${validCount} items)`}
      </Button>
    </div>
  );
}