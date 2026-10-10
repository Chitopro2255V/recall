import { describe, it, expect } from "vitest";
import { review, NEW_CARD, EASE_FLOOR, type CardState, type Rating } from "./sm2";

const DAY = 24 * 60 * 60 * 1000;
const fresh = (): CardState => ({ ...NEW_CARD });

/** Rate a card `n` times, returning every intermediate state. */
function rate(card: CardState, rating: Rating, n: number): CardState[] {
  const states: CardState[] = [];
  for (let i = 0; i < n; i++) {
    card = review(card, rating);
    states.push(card);
  }
  return states;
}

describe("intervals", () => {
  it("new card rated Good ×4 → 1, 6, 15, 38 days (the SM-2 signature)", () => {
    const intervals = rate(fresh(), "good", 4).map((s) => s.intervalDays);
    expect(intervals).toEqual([1, 6, 15, 38]);
  });

  it("Easy grows faster than Good", () => {
    const easy = rate(fresh(), "easy", 4);
    const good = rate(fresh(), "good", 4);
    expect(easy[3].intervalDays).toBeGreaterThan(good[3].intervalDays);
  });

  it("Hard grows slower than Good", () => {
    const hard = rate(fresh(), "hard", 4);
    const good = rate(fresh(), "good", 4);
    expect(hard[3].intervalDays).toBeLessThan(good[3].intervalDays);
  });
});

describe("ease factor", () => {
  it("never drops below 1.3 — even after 100 consecutive fails", () => {
    const states = rate(fresh(), "again", 100);
    const final = states[states.length - 1];
    expect(final.ease).toBeGreaterThanOrEqual(EASE_FLOOR);
    expect(final.ease).toBeCloseTo(EASE_FLOOR);
  });

  it("a fail resets interval and reps, but only nudges ease (2.5 → 2.18)", () => {
    const progressed = rate(fresh(), "good", 3); // interval now 15 days
    const failed = review(progressed[progressed.length - 1], "again");
    expect(failed.intervalDays).toBe(1);
    expect(failed.reps).toBe(0);
    expect(failed.lapses).toBe(1);
    expect(failed.ease).toBeCloseTo(2.18);
  });
});

describe("long-run behavior", () => {
  it("Easy decisively outpaces Hard over 10 reviews", () => {
    const easy = rate(fresh(), "easy", 10);
    const hard = rate(fresh(), "hard", 10);
    expect(easy[9].intervalDays).toBeGreaterThan(hard[9].intervalDays);
  });
});

describe("scheduling", () => {
  it("due date = review time + interval, exactly", () => {
    const now = new Date("2025-01-01T12:00:00.000Z");
    const passed = review(fresh(), "good", now);
    expect(passed.dueAt.getTime()).toBe(now.getTime() + 1 * DAY);

    const failed = review(fresh(), "again", now);
    expect(failed.dueAt.getTime()).toBe(now.getTime() + 1 * DAY);
  });
});