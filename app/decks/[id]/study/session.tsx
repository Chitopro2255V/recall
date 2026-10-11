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
type Mode = "due" | "practice";

export function StudySession({ deckId, mode }: { deckId: string; mode: Mode }) {
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

  // ── Load the queue: due-only normally, everything in practice ──
  useEffect(() => {
    const qs = mode === "practice" ? "&mode=practice" : "";
    fetch(`/api/study?deckId=${deckId}${qs}`)
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
  }, [deckId, mode]);

  // ── Advance to next card / end session. Shared by both modes. ──
  const advance = useCallback(() => {
    setFlipped(false);
    const nextIndex = current + 1;
    if (nextIndex >= queue.length) {
      setPhase("done");
    } else {
      setCurrent(nextIndex);
    }
  }, [current, queue.length]);

  // ── Rate a card (due mode): SM-2 update server-side, then advance ──
  const rate = useCallback(
    async (rating: "again" | "hard" | "good" | "easy") => {
      const card = queue[current];
      if (!card || ratingBusy) return;
      setRatingBusy(true);

      if (rating === "again") {
        setQueue((q) => [...q, card]); // re-queue within this session
        setAgainCount((n) => n + 1);
      } else if (rating === "hard") setHardCount((n) => n + 1);
      else if (rating === "good") setGoodCount((n) => n + 1);
      else setEasyCount((n) => n + 1);

      setAnswered((n) => n + 1);

      fetch("/api/study", {
        method: "POST",
        body: JSON.stringify({ cardId: card.id, rating }),
        headers: { "Content-Type": "application/json" },
      }).catch((err) => console.error("Rating failed to sync:", err));

      advance();
      setRatingBusy(false);
    },
    [queue, current, ratingBusy, advance]
  );

  // ── Keyboard: Space flips · 1–4 rate (due) · Enter advances (practice) ──
  useEffect(() => {
    if (phase !== "studying") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }
      if (mode === "practice") {
        if (e.key === "Enter" && flipped) {
          e.preventDefault();
          advance();
        }
        return;
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) {
        const map = { "1": "again", "2": "hard", "3": "good", "4": "easy" } as const;
        void rate(map[e.key as "1" | "2" | "3" | "4"]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, flipped, rate, advance, mode]);

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
        <p className="mx-auto mt-2 max-w-md text-muted-foreground">
          No cards are due right now — and that&apos;s the algorithm working:
          you&apos;ll remember more by seeing them again tomorrow than today.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {mode === "due" && (
            <Link href={`/decks/${deckId}/study?mode=practice`}>
              <Button>Practice anyway</Button>
            </Link>
          )}
          <Link href="/decks">
            <Button variant="outline">All decks</Button>
          </Link>
        </div>
      </main>
    );
  }

  if (phase === "done") {
    if (mode === "practice") {
      return (
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <p className="text-4xl">📚</p>
          <h1 className="mt-4 text-2xl font-bold">Practice complete!</h1>
          <p className="mt-2 text-muted-foreground">
            You went through {queue.length} cards. Practice never touches your
            schedule — every real review date is exactly where SM-2 left it.
          </p>
          <div className="mt-6 flex justify-center gap-3">
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
  const progress =
    mode === "practice"
      ? ((current + 1) / queue.length) * 100
      : (answered / queue.length) * 100;

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-3xl flex-col px-4 py-8">
      <div className="flex items-center justify-between">
        <Link
          href={`/decks/${deckId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← End session
        </Link>
        <div className="flex items-center gap-2">
          {mode === "practice" && <Badge variant="secondary">Practice</Badge>}
          <span className="text-sm text-muted-foreground">
            {current + 1} / {queue.length}
          </span>
        </div>
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
              mode === "practice" ? (
                <div className="flex justify-center">
                  <Button onClick={advance}>
                    Next <span className="ml-1 text-xs opacity-50">↵</span>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button
                    variant="outline"
                    className="border-destructive/40 text-destructive"
                    onClick={() => void rate("again")}
                    disabled={ratingBusy}
                  >
                    Again <span className="ml-1 text-xs opacity-50">1</span>
                  </Button>
                  <Button variant="outline" onClick={() => void rate("hard")} disabled={ratingBusy}>
                    Hard <span className="ml-1 text-xs opacity-50">2</span>
                  </Button>
                  <Button onClick={() => void rate("good")} disabled={ratingBusy}>
                    Good <span className="ml-1 text-xs opacity-50">3</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="border-primary/40"
                    onClick={() => void rate("easy")}
                    disabled={ratingBusy}
                  >
                    Easy <span className="ml-1 text-xs opacity-50">4</span>
                  </Button>
                </div>
              )
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                {mode === "practice"
                  ? "Flip to check yourself — no ratings in practice mode, just flow."
                  : "Try to recall the answer first — then tap the card (or press Space) to check."}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}