import { z } from "zod";
import { and, eq, lte, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks, cards, reviews } from "@/db/schema";
import { review as sm2Review, type Rating } from "@/lib/sm2";

const cardColumns = {
  id: cards.id,
  front: cards.front,
  back: cards.back,
  ease: cards.ease,
  intervalDays: cards.intervalDays,
  reps: cards.reps,
  lapses: cards.lapses,
};

// ── GET: the study queue ─────────────────────────────────────────
//   ?deckId=...               → due cards only (SM-2 scheduled)
//   ?deckId=...&mode=practice → ALL cards, no schedule impact
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const deckId = url.searchParams.get("deckId");
  const practice = url.searchParams.get("mode") === "practice";

  if (!deckId) {
    return Response.json({ error: "Missing deckId" }, { status: 400 });
  }

  // Practice ignores dueAt; scheduled study enforces it.
  // Ownership via join in both cases (IDOR protection, as always).
  const where = practice
    ? and(
        eq(decks.id, deckId),
        eq(decks.userId, session.user.id),
        ne(cards.status, "suspended")
      )
    : and(
        eq(decks.id, deckId),
        eq(decks.userId, session.user.id),
        lte(cards.dueAt, new Date()),
        ne(cards.status, "suspended")
      );

  const rows = await db
    .select(cardColumns)
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(where)
    .limit(practice ? 50 : 30);

  return Response.json({ cards: rows });
}

// ── POST: rate a card — SM-2 update + review log ─────────────────
// (practice mode never calls this; that's the whole point)

const ratingSchema = z.object({
  cardId: z.string().uuid(),
  rating: z.enum(["again", "hard", "good", "easy"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = ratingSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid rating" }, { status: 400 });
  }
  const { cardId, rating } = parsed.data;

  const [card] = await db
    .select({
      id: cards.id,
      ease: cards.ease,
      intervalDays: cards.intervalDays,
      reps: cards.reps,
      lapses: cards.lapses,
    })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(and(eq(cards.id, cardId), eq(decks.userId, session.user.id)))
    .limit(1);

  if (!card) {
    return Response.json({ error: "Card not found" }, { status: 404 });
  }

  const next = sm2Review(
    { ease: card.ease, intervalDays: card.intervalDays, reps: card.reps, lapses: card.lapses },
    rating as Rating
  );

  await db
    .update(cards)
    .set({
      ease: next.ease,
      intervalDays: next.intervalDays,
      reps: next.reps,
      lapses: next.lapses,
      dueAt: next.dueAt,
      status: "review",
    })
    .where(eq(cards.id, cardId));

  await db.insert(reviews).values({
    cardId,
    rating: { again: 2, hard: 3, good: 4, easy: 5 }[rating],
    intervalAfter: next.intervalDays,
  });

  return Response.json({ nextDueAt: next.dueAt, intervalDays: next.intervalDays });
}