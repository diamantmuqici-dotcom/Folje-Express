import { login } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const pre = rateLimit(`loginpre:${ip}`, 10, 15 * 60_000);
  if (!pre.ok) return tooManyRequests(pre.retryAfter, "Shumë përpjekje. Provo pas pak.");

  const { username, password } = await request.json().catch(() => ({}));
  const result = await login(String(username ?? ""), String(password ?? ""), ip);

  if (result.throttled) {
    await audit(null, "login.throttled", `username=${String(username).slice(0, 40)}`, ip);
    return tooManyRequests(result.retryAfter, "Shumë përpjekje për hyrje. Provo pas pak.");
  }
  if (!result.ok) {
    await audit(null, "login.failed", `username=${String(username).slice(0, 40)}`, ip);
    return Response.json({ error: "Kredencialet nuk janë të sakta." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  await audit({ username: result.account.username, role: result.account.role }, "login", "Hyrje në panel", ip);
  return Response.json({ ok: true, username: result.account.username, role: result.account.role });
}
