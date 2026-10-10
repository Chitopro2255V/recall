/**
 * SM-2 spaced repetition engine — implemented from scratch.
 *
 * Based on the SuperMemo-2 algorithm by Piotr Woźniak (1987) — the
 * scheduling system that powers Anki (in modified form).
 *
 * Pure functions: no I/O, no database, no React. Given a card's state
 * and a rating, returns the card's next state + due date. This purity
 * is what makes it fully unit-testable — see sm2.test.ts.
 */

export type Rating = "again" | "hard" | "good" | "easy";

// SM-2 scores "quality of response" on a 0–5 scale; the four buttons
// map to the four meaningful values (0–1, total blackouts, fold into "again").
export const QUALITY: Record<Rating, 2 | 3 | 4 | 5> = {
  again: 2,
  hard: 3,
  good: 4,
  easy: 5,
};

/** Ease may sink, but never below this — otherwise intervals stop growing forever. */
export const EASE_FLOOR = 1.3;

export type CardState = {
  /** Ease factor — multiplies the interval on each successful review. Starts at 2.5. */
  ease: number;
  /** Current interval in days. 0 for a brand-new card. */
  intervalDays: number;
  /** Consecutive successful reviews. */
  reps: number;
  /** Total times the card was ever forgotten (rated "again"). */
  lapses: number;
};

/** Every card starts here — same defaults as the cards table schema. */
export const NEW_CARD: CardState = { ease: 2.5, intervalDays: 0, reps: 0, lapses: 0 };

const DAY_MS = 24 * 60 * 60 * 1000;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The SM-2 ease update formula:
 *   EF' = EF + (0.1 − (5−q) × (0.08 + (5−q) × 0.02)), floored at 1.3
 *
 * q=5 → +0.10, q=4 → 0, q=3 → −0.14, q=2 → −0.32
 */
function updateEase(ease: number, q: number): number {
  const delta = 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02);
  return round2(Math.max(EASE_FLOOR, ease + delta));
}

/**
 * Schedule a card after a review.
 *
 * Pass (hard/good/easy): reps++, interval follows 1 → 6 → round(prev × ease)
 * Fail (again): interval back to 1 day, reps reset, lapses++, ease penalized.
 *
 * Design note: "again" keeps day granularity here. The study screen
 * (Phase 3) additionally re-queues "again" cards within the same session —
 * scheduling decides when the card returns *if the user stops studying now*.
 */
export function review(
  card: CardState,
  rating: Rating,
  now: Date = new Date()
): CardState & { dueAt: Date } {
  const q = QUALITY[rating];
  const ease = updateEase(card.ease, q);

  if (q < 3) {
    const intervalDays = 1;
    return {
      ease,
      intervalDays,
      reps: 0,
      lapses: card.lapses + 1,
      dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
    };
  }

  const reps = card.reps + 1;
  const intervalDays =
    reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.intervalDays * ease);

  return {
    ease,
    intervalDays,
    reps,
    lapses: card.lapses,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}