import { guard } from "@/lib/auth";
import { readLogs } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Audit trail — Co Owner & Owner only. Admins and Staff get 403. */
export async function GET() {
  const g = await guard("logs.view");
  if (!g.ok) return g.response;
  return Response.json(await readLogs(), { headers: { "Cache-Control": "no-store" } });
}
