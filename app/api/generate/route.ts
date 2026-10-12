import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { auth } from "@/auth";
import { chunkPages, type PageText } from "@/lib/chunker";
import type { GeneratedCard } from "@/lib/card-types";

export const maxDuration = 60;

const MAX_CHARS = 90_000;
const MAX_CARDS = 100;

type Mode = "flashcard" | "quiz" | "tf";

const flashcardSchema = z.object({
  cards: z.array(z.object({
    front: z.string().min(1).max(300),
    back: z.string().min(1).max(1000),
    sourcePage: z.number().int().min(0),
  })),
});

const mcSchema = z.object({
  questions: z.array(z.object({
    question: z.string().min(1).max(300),
    options: z.array(z.string().min(1).max(300)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    sourcePage: z.number().int().min(0),
  })),
});

const tfSchema = z.object({
  statements: z.array(z.object({
    statement: z.string().min(1).max(300),
    answer: z.boolean(),
    sourcePage: z.number().int().min(0),
  })),
});

const BASE_RULES = `- Only use information present in the material. Never invent.
- Each item tests exactly ONE concept.
- sourcePage: the page number where the answer appears.
- Skip fluff, headers, page furniture, citations.`;

const PROMPTS: Record<Mode, string> = {
  flashcard: `${BASE_RULES}
- Front: a specific question with exactly one correct answer.
- Back: 1-3 sentences, self-contained.
- Generate 5-12 cards.`,
  quiz: `${BASE_RULES}
- Exactly 4 options, exactly one correct.
- Distractors must be plausible but clearly wrong to someone who knows the material.
- Vary the correct answer's position across questions (don't always put it first).
- Generate 3-8 questions.`,
  tf: `${BASE_RULES}
- Statements must be unambiguously true or false based on the material.
- Aim for roughly half true and half false — a list of all-true is useless for studying.
- Generate 5-10 statements.`,
};

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
  const mode: Mode =
    body?.mode === "quiz" ? "quiz" : body?.mode === "tf" ? "tf" : "flashcard";

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

  try {
    const results = await mapLimit(chunks, 2, async (chunk) => {
      const material = `Material (pages ${chunk.startPage}–${chunk.endPage}):\n\n${chunk.text}`;

      // Each mode: its own schema, its own prompt, normalized to GeneratedCard[]
      if (mode === "quiz") {
        const r = await generateObject({
          model: google("gemini-flash-latest"),
          schema: mcSchema,
          system: PROMPTS.quiz,
          prompt: material,
          maxRetries: 1,
        });
        return r.object.questions.map<GeneratedCard>((q) => ({
          type: "mc",
          front: q.question,
          back: q.options[q.correctIndex],
          options: q.options,
          correctIndex: q.correctIndex,
          sourcePage: q.sourcePage || chunk.startPage,
        }));
      }

      if (mode === "tf") {
        const r = await generateObject({
          model: google("gemini-flash-latest"),
          schema: tfSchema,
          system: PROMPTS.tf,
          prompt: material,
          maxRetries: 1,
        });
        return r.object.statements.map<GeneratedCard>((s) => ({
          type: "tf",
          front: s.statement,
          back: s.answer ? "True" : "False",
          options: ["True", "False"],
          correctIndex: s.answer ? 0 : 1,
          sourcePage: s.sourcePage || chunk.startPage,
        }));
      }

      const r = await generateObject({
        model: google("gemini-flash-latest"),
        schema: flashcardSchema,
        system: PROMPTS.flashcard,
        prompt: material,
        // Speed boost (3-4x): uncomment ONLY if @ai-sdk/google is v2+
        providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } },
        maxRetries: 1,
      });
      return r.object.cards.map<GeneratedCard>((c) => ({
        type: "basic",
        front: c.front,
        back: c.back,
        sourcePage: c.sourcePage || chunk.startPage,
      }));
    });

    const seen = new Set<string>();
    const cards = results
      .flat()
      .filter((c) => {
        const key = c.front.trim().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, MAX_CARDS);

    return Response.json({ cards });
  } catch (err) {
    const e = err as { statusCode?: number; data?: { status?: number }; message?: string };
    const status = e.statusCode ?? e.data?.status;
    const msg = String(err);

    if (status === 429 || msg.includes("429") || msg.includes("RESOURCE_EXHAUSTED") || msg.includes("quota")) {
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
}