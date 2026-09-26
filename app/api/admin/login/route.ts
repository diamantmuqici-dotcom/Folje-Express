import { login } from "@/lib/auth";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const ip = clientIp(request);
  const pre = rateLimit(`loginpre:${ip}`, 10, 15 * 60_000);
  if (!pre.ok) return tooManyRequests(pre.retryAfter, "Shumë përpjekje. Provo pas pak.");

  const { password } = await request.json().catch(() => ({}));
  const result = await login(String(password ?? ""), ip);

  if (result.throttled) {
    return tooManyRequests(result.retryAfter, "Shumë përpjekje për hyrje. Provo pas pak.");
  }
  if (!result.ok) {
    return Response.json(
      { error: result.notConfigured ? "ADMIN_PASSWORD nuk është konfiguruar." : "Fjalëkalimi nuk është i saktë." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }
  return Response.json({ ok: true });
}
