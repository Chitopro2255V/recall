import { z } from "zod";
import { and, eq, lte, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks, cards, reviews } from "@/db/schema";
import { review as sm2Review, type Rating } from "@/lib/sm2";

// ── Start a session: fetch due cards ─────────────────────────────
// GET /api/study?deckId=...

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deckId = new URL(req.url).searchParams.get("deckId");
  if (!deckId) {
    return Response.json({ error: "Missing deckId" }, { status: 400 });
  }

  // Ownership baked into the query (IDOR protection, like always).
  // Due = dueAt <= now, excluding suspended cards. Limit 30 keeps
  // sessions focused — Anki does the same.
  const dueCards = await db
    .select({
      id: cards.id,
      front: cards.front,
      back: cards.back,
      ease: cards.ease,
      intervalDays: cards.intervalDays,
      reps: cards.reps,
      lapses: cards.lapses,
    })
    .from(cards)
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(
      and(
        eq(decks.id, deckId),
        eq(decks.userId, session.user.id),
        lte(cards.dueAt, new Date()),
        ne(cards.status, "suspended")
      )
    )
    .limit(30);

  return Response.json({ cards: dueCards });
}

// ── Rate a card: SM-2 → DB ───────────────────────────────────────
// POST /api/study  { cardId, rating }

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

  // Load the card AND verify ownership via join — one query.
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

  // ── The heart of the whole app: our tested engine decides ──
  const next = sm2Review(
    { ease: card.ease, intervalDays: card.intervalDays, reps: card.reps, lapses: card.lapses },
    rating as Rating
  );

  // Two writes: update card state + append to the immutable review log.
  // The log is what powers Phase 4's stats — never skip it.
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

  return Response.json({
    nextDueAt: next.dueAt,
    intervalDays: next.intervalDays,
  });
}