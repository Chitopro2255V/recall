import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StudySession } from "./session";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  return <StudySession deckId={id} />;
}