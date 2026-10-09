import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks, cards } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function DecksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const rows = await db
    .select({
      id: decks.id,
      title: decks.title,
      createdAt: decks.createdAt,
      cardCount: sql<number>`count(${cards.id})::int`,
    })
    .from(decks)
    .leftJoin(cards, eq(cards.deckId, decks.id))
    .where(eq(decks.userId, session.user.id))
    .groupBy(decks.id)
    .orderBy(desc(decks.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Your decks</h1>
        <Link href="/upload">
          <Button>+ New deck</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-16 text-center space-y-3">
          <p className="text-muted-foreground">No decks yet.</p>
          <Link href="/upload">
            <Button variant="outline">Create your first deck</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {rows.map((d) => (
            <UICard key={d.id}>
              <CardHeader>
                <CardTitle className="text-lg">{d.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {d.cardCount} {d.cardCount === 1 ? "card" : "cards"} ·{" "}
                {new Date(d.createdAt).toLocaleDateString()}
              </CardContent>
            </UICard>
          ))}
        </div>
      )}
    </main>
  );
}