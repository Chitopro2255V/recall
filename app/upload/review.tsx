"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card as UICard, CardContent } from "@/components/ui/card";

export type FlashCard = { front: string; back: string; sourcePage: number };

export function ReviewEditor({
  initialCards,
  sourceFilename,
}: {
  initialCards: FlashCard[];
  sourceFilename: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(
    sourceFilename.replace(/\.pdf$/i, "") || "Untitled deck"
  );
  const [cards, setCards] = useState(initialCards);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (i: number, field: "front" | "back", value: string) =>
    setCards((prev) => prev.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)));

  const remove = (i: number) => setCards((prev) => prev.filter((_, idx) => idx !== i));

  const validCount = cards.filter((c) => c.front.trim() && c.back.trim()).length;

  const save = async () => {
    setError("");
    if (!title.trim()) return setError("Give your deck a title.");
    if (validCount === 0) return setError("Keep at least one card with both sides filled in.");

    setSaving(true);
    try {
      const res = await fetch("/api/decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          sourceFilename,
          cards: cards
            .filter((c) => c.front.trim() && c.back.trim())
            .map((c) => ({
              front: c.front.trim(),
              back: c.back.trim(),
              sourcePage: c.sourcePage,
            })),
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
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {cards.length} cards — fix anything the AI got wrong, delete the junk. Cards with
        an empty side are dropped when you save. Nothing is stored until you hit Save.
      </p>
      <div className="space-y-3">
        {cards.map((c, i) => (
          <UICard key={i}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Card {i + 1} · p. {c.sourcePage}
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                  Delete
                </Button>
              </div>
              <Input
                value={c.front}
                onChange={(e) => update(i, "front", e.target.value)}
                placeholder="Front (question)"
                maxLength={300}
              />
              <Textarea
                value={c.back}
                onChange={(e) => update(i, "back", e.target.value)}
                placeholder="Back (answer)"
                maxLength={1000}
                rows={3}
              />
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
        {saving ? "Saving…" : `Save deck (${validCount} cards)`}
      </Button>
    </div>
  );
}