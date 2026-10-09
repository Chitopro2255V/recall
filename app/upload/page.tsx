import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Uploader } from "./uploader";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Create a deck</h1>
      <p className="mt-2 text-muted-foreground">
        Drop a PDF — we&apos;ll extract the text in your browser, generate
        flashcards with AI, and you&apos;ll review them before anything is saved.
      </p>
      <Uploader />
    </main>
  );
}