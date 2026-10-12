import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks, cards } from "@/db/schema";

const basicCard = z.object({
  type: z.literal("basic"),
  front: z.string().min(1).max(300),
  back: z.string().min(1).max(1000),
  sourcePage: z.number().int().min(0).optional().nullable(),
});

const quizCard = z
  .object({
    type: z.enum(["mc", "tf"]),
    front: z.string().min(1).max(300),
    back: z.string().min(1).max(1000),
    options: z.array(z.string().min(1).max(300)).min(2).max(4),
    correctIndex: z.number().int().min(0),
    sourcePage: z.number().int().min(0).optional().nullable(),
  })
  .refine((c) => c.correctIndex < c.options.length, {
    message: "correctIndex must point at a real option",
  });

const createDeckSchema = z.object({
  title: z.string().min(1).max(120),
  sourceFilename: z.string().max(255).nullable().optional(),
  cards: z.array(z.union([basicCard, quizCard])).min(1).max(100),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createDeckSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid deck data." }, { status: 400 });
  }
  const { title, sourceFilename, cards: cardData } = parsed.data;

  const deckId = crypto.randomUUID();
  await db.insert(decks).values({
    id: deckId,
    userId: session.user.id,
    title,
    sourceFilename: sourceFilename ?? null,
  });

  try {
    await db.insert(cards).values(
      cardData.map((c) => ({
        deckId,
        front: c.front,
        back: c.back,
        type: c.type,
        options: c.type === "basic" ? null : c.options,
        correctIndex: c.type === "basic" ? null : c.correctIndex,
        sourcePage: c.sourcePage ?? null,
      }))
    );
  } catch {
    await db.delete(decks).where(eq(decks.id, deckId));
    return Response.json({ error: "Failed to save cards." }, { status: 500 });
  }

  return Response.json({ deckId });
}