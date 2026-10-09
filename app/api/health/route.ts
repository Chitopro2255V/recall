import { sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export async function GET() {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);

    return Response.json({ status: "ok", db: "connected", users: row?.count ?? 0 });
  } catch (err) {
    return Response.json(
      { status: "error", db: "not connected", message: String(err) },
      { status: 500 }
    );
  }
}