import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks, cards } from "@/db/schema";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { DeleteDeckButton } from "./delete-button";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  // Next 15+: params is a Promise — must await it
  const { id } = await params;

  // A non-UUID string would crash the DB query with a 500.
  // Validate first → clean 404 instead.
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRe.test(id)) notFound();

  // IDOR protection: the userId check is IN the query, not after it —
  // decks you don't own are indistinguishable from decks that don't exist.
  const [deck] = await db
    .select()
    .from(decks)
    .where(and(eq(decks.id, id), eq(decks.userId, session.user.id)))
    .limit(1);

  if (!deck) notFound();

  const deckCards = await db
    .select()
    .from(cards)
    .where(eq(cards.deckId, deck.id))
    .orderBy(asc(cards.createdAt));

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/decks" className="text-sm text-muted-foreground hover:text-foreground">
            ← All decks
          </Link>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight">{deck.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {deckCards.length} {deckCards.length === 1 ? "card" : "cards"} · created{" "}
            {new Date(deck.createdAt).toLocaleDateString()}
            {deck.sourceFilename ? ` · from ${deck.sourceFilename}` : ""}
          </p>
        </div>
        <DeleteDeckButton deckId={deck.id} deckTitle={deck.title} />
      </div>

      <div className="mt-8 space-y-3">
        {deckCards.map((c) => (
          <UICard key={c.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="break-words font-medium">{c.front}</p>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {c.status}
                  {c.sourcePage ? ` · p. ${c.sourcePage}` : ""}
                </span>
              </div>
              <p className="break-words text-sm text-muted-foreground">{c.back}</p>
            </CardContent>
          </UICard>
        ))}
      </div>
    </main>
  );
}