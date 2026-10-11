import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudySession } from "./session";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const { mode } = await searchParams;

  return <StudySession deckId={id} mode={mode === "practice" ? "practice" : "due"} />;
}