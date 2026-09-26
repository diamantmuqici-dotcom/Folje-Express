import { guard, updateOwnAccount } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Every role can rename itself or change its own password. */
export async function PATCH(request: Request) {
  const g = await guard("messages.view"); // any logged-in role
  if (!g.ok) return g.response;
  const { username, password, currentPassword } = await request.json().catch(() => ({}));
  const result = await updateOwnAccount(g.session, {
    username: typeof username === "string" ? username : undefined,
    password: typeof password === "string" ? password : undefined,
    currentPassword: typeof currentPassword === "string" ? currentPassword : undefined,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  const changes = [username && "emri", password && "fjalëkalimi"].filter(Boolean).join(", ");
  await audit(g.session, "profile.update", `llogaria e vet: ${changes}`, clientIp(request));
  return Response.json({ ok: true, username: result.account.username, role: result.account.role });
}
