import { readStats, writeStats } from "@/lib/store";
import { rateLimit, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Visit beacon. The homepage sends one POST per load; the rate limiter makes
 * repeat hits from the same IP within 10 minutes free, so refresh-spam cannot
 * inflate the counter.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = rateLimit(`track:${ip}`, 1, 10 * 60_000);
  if (!limit.ok) return Response.json({ ok: true }); // counted already, stay quiet

  const stats = await readStats();
  stats.visits += 1;
  stats.lastVisitAt = new Date().toISOString();
  await writeStats(stats);
  return Response.json({ ok: true });
}
