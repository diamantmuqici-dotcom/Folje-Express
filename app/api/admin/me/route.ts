import { getSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who am I? Used by the admin UI to bootstrap role-aware navigation. */
export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Nuk je i autorizuar." }, { status: 401 });
  return Response.json(session, { headers: { "Cache-Control": "no-store" } });
}
