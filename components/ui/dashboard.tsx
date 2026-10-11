import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { decks, cards, reviews } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";

export async function Dashboard({ userId }: { userId: string }) {
  // One query for every deck + per-deck counts. The FILTER clause is
  // conditional aggregation: count only rows matching the condition —
  // the alternative is one extra query per deck (the classic N+1 problem).
  const rows = await db
    .select({
      id: decks.id,
      title: decks.title,
      totalCards: sql<number>`count(${cards.id})::int`,
      dueCards: sql<number>`count(${cards.id}) filter (where ${cards.dueAt} <= now() and ${cards.status} <> 'suspended')::int`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(eq(decks.userId, userId))
    .groupBy(decks.id)
    .orderBy(desc(decks.createdAt));

  // Reviews have no userId column — ownership is derived by joining
  // through cards → decks. (It's 0 today; the study screen is why it exists.)
  const [reviewStats] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(reviews)
    .innerJoin(cards, eq(reviews.cardId, cards.id))
    .innerJoin(decks, eq(cards.deckId, decks.id))
    .where(eq(decks.userId, userId));

  const totalCards = rows.reduce((n, r) => n + r.totalCards, 0);
  const totalDue = rows.reduce((n, r) => n + r.dueCards, 0);
  const totalReviews = reviewStats?.n ?? 0;

  const stats = [
    { label: "Decks", value: rows.length },
    { label: "Cards", value: totalCards },
    { label: "Due now", value: totalDue },
    { label: "Reviews logged", value: totalReviews },
  ];

  if (rows.length === 0) {
    return (
      <div className="mt-12 rounded-xl border border-dashed p-12 text-center">
        <h2 className="text-xl font-semibold">No decks yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Drop in your first PDF and Recall will turn it into a study deck.
        </p>
        <Link href="/upload" className="mt-4 inline-block">
          <Button>+ Create your first deck</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-8">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <UICard key={s.label}>
            <CardContent className="p-6">
              <p className="text-3xl font-bold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </CardContent>
          </UICard>
        ))}
      </div>

      {totalDue > 0 && (
        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-muted/40 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-medium">
              {totalDue} {totalDue === 1 ? "card is" : "cards are"} due for review
            </p>
            <p className="text-sm text-muted-foreground">
              Spaced repetition works best with a little every day.
            </p>
          </div>
          <Link href="/decks">
            <Button>Start studying →</Button>
          </Link>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight">Your decks</h2>
          <Link href="/upload">
            <Button variant="outline" size="sm">+ New deck</Button>
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((d) => (
            <Link key={d.id} href={`/decks/${d.id}`} className="group">
              <UICard className="h-full transition-colors group-hover:border-muted-foreground/40">
                <CardContent className="p-6">
                  <p className="truncate font-medium" title={d.title}>{d.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {d.dueCards > 0 && (
                      <>
                        <span className="font-medium text-foreground">{d.dueCards} due</span>
                        {" · "}
                      </>
                    )}
                    {d.totalCards} {d.totalCards === 1 ? "card" : "cards"}
                  </p>
                </CardContent>
              </UICard>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}