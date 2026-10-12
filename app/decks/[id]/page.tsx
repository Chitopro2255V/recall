import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks, cards } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { DeleteDeckButton } from "./delete-button";

export const dynamic = "force-dynamic";

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TYPE_LABEL: Record<string, string> = { basic: "Flashcard", mc: "Quiz", tf: "True/False" };

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  if (!uuidRe.test(id)) notFound();

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
            {deckCards.length} {deckCards.length === 1 ? "item" : "items"} · created{" "}
            {new Date(deck.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <Link href={`/decks/${deck.id}/study`}>
            <Button>Study</Button>
          </Link>
          <Link href={`/decks/${deck.id}/study?mode=practice`}>
            <Button variant="outline">Practice</Button>
          </Link>
          <DeleteDeckButton deckId={deck.id} deckTitle={deck.title} />
        </div>
      </div>

      <div className="mt-8 space-y-3">
        {deckCards.map((c) => (
          <UICard key={c.id}>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="break-words font-medium">{c.front}</p>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {TYPE_LABEL[c.type] ?? c.type} · {c.status}
                  {c.sourcePage ? ` · p. ${c.sourcePage}` : ""}
                </span>
              </div>

              {c.type === "mc" && c.options && (
                <div className="space-y-1.5">
                  {c.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        oi === c.correctIndex
                          ? "border-primary/60 bg-muted font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {opt}
                      {oi === c.correctIndex && <span className="ml-2 text-xs">✓ correct</span>}
                    </div>
                  ))}
                </div>
              )}

              {c.type === "tf" && (
                <Badge variant={c.correctIndex === 0 ? "default" : "secondary"}>
                  Answer: {c.back}
                </Badge>
              )}

              {c.type === "basic" && (
                <p className="break-words text-sm text-muted-foreground">{c.back}</p>
              )}
            </CardContent>
          </UICard>
        ))}
      </div>
    </main>
  );
}