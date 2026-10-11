import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { auth } from "@/auth";
import { chunkPages, type PageText } from "@/lib/chunker";

// Vercel Hobby hard-caps functions at 60s no matter what we declare —
// so we declare honestly and size the work to fit inside it.
export const maxDuration = 60;

const MAX_CHARS = 90_000; // ~22 dense pages — worst case fits in the 60s budget
const MAX_CARDS = 100;

const SYSTEM_PROMPT = `You are an expert flashcard author creating a study deck from source material.

Rules:
- Extract the most important testable concepts: definitions, mechanisms, comparisons, cause and effect. Skip fluff, headers, page furniture, citations.
- Each card tests exactly ONE concept.
- Front: a specific question with exactly one correct answer. Prefer why/how/what-distinguishes over guessable trivia.
- Back: 1-3 sentences, self-contained.
- Only use information present in the material. Never invent.
- sourcePage: the page number where the answer appears.
- Generate 5-12 cards. Fewer is fine if the material is thin.`;

const cardListSchema = z.object({
  cards: z.array(
    z.object({
      front: z.string().min(1).max(300),
      back: z.string().min(1).max(1000),
      sourcePage: z.number().int().min(0),
    })
  ),
});

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const pages: PageText[] = (Array.isArray(body?.pages) ? body.pages : [])
    .map((p: { page?: number; text?: string }) => ({
      page: Number(p?.page) || 1,
      text: String(p?.text ?? ""),
    }))
    .filter((p: PageText) => p.text.trim().length > 0);

  const totalChars = pages.reduce((n, p) => n + p.text.length, 0);
  if (pages.length === 0 || totalChars < 200) {
    return Response.json({ error: "No usable text found in the document." }, { status: 400 });
  }
  if (totalChars > MAX_CHARS) {
    return Response.json(
      { error: "Document too long for v1 (max ~22 pages). Try a shorter PDF." },
      { status: 400 }
    );
  }

  const chunks = chunkPages(pages);
  let cards: { front: string; back: string; sourcePage: number }[];

  try {
    const results = await mapLimit(chunks, 2, (chunk) =>
      generateObject({
        model: google("gemini-flash-latest"),
        schema: cardListSchema,
        system: SYSTEM_PROMPT,
        prompt: `Material (pages ${chunk.startPage}–${chunk.endPage}):\n\n${chunk.text}`,
        // Card extraction needs no chain-of-thought. Disabling "thinking"
        // cuts per-call latency from ~25s to ~5-10s.
        providerOptions: {
          google: { thinkingConfig: { thinkingBudget: 0 } },
        },
        // Default is 2 silent retries with backoff — on a 429 that's a
        // minute of looking "hung". Fail fast and say what happened.
        maxRetries: 1,
      }).then((r) =>
        r.object.cards.map((c) => ({ ...c, sourcePage: c.sourcePage || chunk.startPage }))
      )
    );

    const seen = new Set<string>();
    cards = results
      .flat()
      .filter((c) => {
        const key = c.front.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_CARDS);
  } catch (err) {
    const msg = String(err);

    // 429 = Gemini free-tier quota. One key serves EVERY user of the app,
    // so concurrent testers drain it together.
    if (msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
      return Response.json(
        {
          error:
            "The AI hit its free-tier rate limit (it's shared by all users of this app). Wait about a minute and try again — if it persists, today's daily quota may be exhausted.",
        },
        { status: 429 }
      );
    }

    return Response.json({ error: "Card generation failed", detail: msg }, { status: 500 });
  }

  return Response.json({ cards });
}