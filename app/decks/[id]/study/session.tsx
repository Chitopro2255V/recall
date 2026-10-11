"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Flashcard } from "./flashcard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card as UICard, CardContent } from "@/components/ui/card";

type StudyCard = {
  id: string;
  front: string;
  back: string;
  ease: number;
  intervalDays: number;
  reps: number;
  lapses: number;
};

type Phase = "loading" | "studying" | "empty" | "done" | "error";

export function StudySession({ deckId }: { deckId: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<StudyCard[]>([]);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answered, setAnswered] = useState(0);
  const [againCount, setAgainCount] = useState(0);
  const [hardCount, setHardCount] = useState(0);
  const [goodCount, setGoodCount] = useState(0);
  const [easyCount, setEasyCount] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);

  // ── Load the due queue ──
  useEffect(() => {
    fetch(`/api/study?deckId=${deckId}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Failed to load");
        setQueue(body.cards);
        setPhase(body.cards.length === 0 ? "empty" : "studying");
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });
  }, [deckId]);

  // ── Rate the current card ──
  const rate = useCallback(
    async (rating: "again" | "hard" | "good" | "easy") => {
      const card = queue[current];
      if (!card || ratingBusy) return;
      setRatingBusy(true);
      setFlipped(false);

      if (rating === "again") {
        // Re-queue within this session: card goes to the back of the line.
        setQueue((q) => [...q, card]);
        setAgainCount((n) => n + 1);
      } else {
        if (rating === "hard") setHardCount((n) => n + 1);
        if (rating === "good") setGoodCount((n) => n + 1);
        if (rating === "easy") setEasyCount((n) => n + 1);
      }

      setAnswered((n) => n + 1);

      // Fire and forget: the POST updates SM-2 state server-side.
      // Errors surface via console — the session continues regardless
      // (a failed sync shouldn't block studying).
      fetch("/api/study", {
        method: "POST",
        body: JSON.stringify({ cardId: card.id, rating }),
        headers: { "Content-Type": "application/json" },
      }).catch((err) => console.error("Rating failed to sync:", err));

      const nextIndex = current + 1;
      if (nextIndex >= queue.length) {
        setPhase("done");
      } else {
        setCurrent(nextIndex);
      }
      setRatingBusy(false);
    },
    [queue, current, ratingBusy]
  );

  // ── Keyboard shortcuts: space flips, 1–4 rate ──
  useEffect(() => {
    if (phase !== "studying") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      }
      if (flipped && (e.key === "1" || e.key === "2" || e.key === "3" || e.key === "4")) {
        const map = { "1": "again", "2": "hard", "3": "good", "4": "easy" } as const;
        void rate(map[e.key]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, flipped, rate]);

  // ── Renders ──

  if (phase === "loading") {
    return (
      <main className="mx-auto flex max-w-3xl items-center justify-center px-4 py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
      </main>
    );
  }

  if (phase === "error") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-destructive">{error}</p>
        <Link href={`/decks/${deckId}`} className="mt-4 inline-block">
          <Button variant="outline">← Back to deck</Button>
        </Link>
      </main>
    );
  }

  if (phase === "empty") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="mt-4 text-2xl font-bold">All caught up!</h1>
        <p className="mt-2 text-muted-foreground">
          No cards are due in this deck right now. Come back later — or check your other decks.
        </p>
        <Link href="/decks" className="mt-6 inline-block">
          <Button variant="outline">← All decks</Button>
        </Link>
      </main>
    );
  }

  if (phase === "done") {
    const total = answered;
    const positives = hardCount + goodCount + easyCount;
    return (
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-4xl">✅</p>
        <h1 className="mt-4 text-2xl font-bold">Session complete!</h1>
        <div className="mx-auto mt-8 max-w-md space-y-3 text-left">
          <UICard>
            <CardContent className="flex items-center justify-between p-4">
              <span>Cards rated</span>
              <span className="font-bold">{total}</span>
            </CardContent>
          </UICard>
          <UICard>
            <CardContent className="flex items-center justify-between p-4">
              <span>Again</span>
              <Badge variant="destructive">{againCount}</Badge>
            </CardContent>
          </UICard>
          <UICard>
            <CardContent className="flex items-center justify-between p-4">
              <span>Hard / Good / Easy</span>
              <span className="font-medium">
                {hardCount} / {goodCount} / {easyCount}
                {total > 0 && (
                  <span className="ml-2 text-muted-foreground">
                    ({Math.round((positives / total) * 100)}% recalled)
                  </span>
                )}
              </span>
            </CardContent>
          </UICard>
        </div>
        <div className="mt-8 flex justify-center gap-3">
          <Link href={`/decks/${deckId}`}>
            <Button variant="outline">Back to deck</Button>
          </Link>
          <Link href="/decks">
            <Button>All decks</Button>
          </Link>
        </div>
      </main>
    );
  }

  // ── studying ──
  const card = queue[current];
  const progress = (answered / queue.length) * 100;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-8">
      <div className="flex items-center justify-between">
        <Link href={`/decks/${deckId}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← End session
        </Link>
        <span className="text-sm text-muted-foreground">
          {current + 1} / {queue.length}
        </span>
      </div>

      <div className="mt-4">
        <Progress value={progress} />
      </div>

      <div className="mt-8 flex flex-1 items-center justify-center">
        <div className="w-full max-w-2xl">
          <Flashcard
            front={card.front}
            back={card.back}
            flipped={flipped}
            onFlip={() => setFlipped((f) => !f)}
          />

          <div className="mt-8">
            {flipped ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => void rate("again")} disabled={ratingBusy}>
                  Again <span className="ml-1 text-xs opacity-50">1</span>
                </Button>
                <Button variant="outline" onClick={() => void rate("hard")} disabled={ratingBusy}>
                  Hard <span className="ml-1 text-xs opacity-50">2</span>
                </Button>
                <Button onClick={() => void rate("good")} disabled={ratingBusy}>
                  Good <span className="ml-1 text-xs opacity-50">3</span>
                </Button>
                <Button variant="outline" className="border-primary/40" onClick={() => void rate("easy")} disabled={ratingBusy}>
                  Easy <span className="ml-1 text-xs opacity-50">4</span>
                </Button>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Try to recall the answer first — then tap the card (or press Space) to check.
              </p>
              )}
          </div>
        </div>
      </div>
    </main>
  );
}