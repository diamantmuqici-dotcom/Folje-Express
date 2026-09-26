import { getSession, logout } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getSession();
  if (session) await audit(session, "logout", "Dalje nga paneli", clientIp(request));
  await logout();
  return Response.json({ ok: true });
}
