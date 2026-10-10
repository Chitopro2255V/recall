import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: "⚡",
    title: "Decks in seconds",
    description:
      "Drop in any PDF and Recall pulls out the key concepts as flashcards. You review and approve every card before it's saved — the AI drafts, you decide.",
  },
  {
    icon: "🧠",
    title: "Spaced repetition, done right",
    description:
      "Every card is scheduled with the SM-2 algorithm — the same system behind Anki — so you review each concept right before you'd forget it.",
  },
  {
    icon: "🔒",
    title: "Private by design",
    description:
      "Your PDF is parsed entirely in your browser. The file never leaves your machine — only the text needed to generate your cards is ever sent.",
  },
];

const steps = [
  {
    n: 1,
    title: "Drop a PDF",
    description: "Text is extracted instantly — right in your browser.",
  },
  {
    n: 2,
    title: "Review & edit",
    description: "Approve, fix, or delete each AI-generated card. Nothing is saved until you say so.",
  },
  {
    n: 3,
    title: "Study on schedule",
    description: "Recall tells you exactly which cards are due today. Rate each one and the schedule adapts.",
  },
];

export default async function Home() {
  const session = await auth();

  // ── Signed out: the landing page ──
  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col">
        <section className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
          <span className="rounded-full border px-3 py-1 text-sm text-muted-foreground">
            Free · Open source · No passwords
          </span>
          <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
            Turn any PDF into flashcards you&apos;ll actually remember
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Recall extracts the key concepts with AI, then schedules every card with
            spaced repetition — so you study what matters, exactly when you&apos;re
            about to forget it.
          </p>
          <Link href="/login">
            <Button size="lg">Get started — it&apos;s free</Button>
          </Link>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title}>
              <CardHeader>
                <span className="text-3xl">{f.icon}</span>
                <CardTitle className="mt-2 text-lg">{f.title}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {f.description}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-24">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n} className="rounded-xl border p-6">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {s.n}
                </span>
                <h3 className="mt-4 font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t py-8 text-center text-sm text-muted-foreground">
          Built with Next.js, Neon &amp; Gemini ·{" "}
          <a
            href="https://github.com/Chitopro2255V/recall"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4 hover:text-foreground"
          >
            View the source on GitHub
          </a>
        </footer>
      </main>
    );
  }

  // ── Signed in: quick actions ──
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Welcome back 👋</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium">{session.user.email}</span>
        </p>
      </div>
      <div className="flex gap-3">
        <Link href="/upload">
          <Button size="lg">+ Create a deck</Button>
        </Link>
        <Link href="/decks">
          <Button size="lg" variant="outline">Your decks</Button>
        </Link>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <Button variant="ghost" type="submit">Sign out</Button>
      </form>
    </main>
  );
}