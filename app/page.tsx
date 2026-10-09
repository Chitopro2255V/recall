import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
        <div className="text-center space-y-3">
          <h1 className="text-5xl font-bold tracking-tight">Recall</h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Drop in a PDF, get flashcards in seconds — and actually remember them
            with built-in spaced repetition.
          </p>
        </div>
        <Link href="/login">
          <Button size="lg">Get started</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Recall</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium">{session.user.email}</span> ✅
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
        <Button variant="outline" type="submit">Sign out</Button>
      </form>
    </main>
  );
}