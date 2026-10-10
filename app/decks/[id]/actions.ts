"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { decks } from "@/db/schema";

export async function deleteDeck(deckId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  await db.delete(decks).where(and(eq(decks.id, deckId), eq(decks.userId, session.user.id)));

  redirect("/decks");
}