import { guard } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";
import { resetSiteData } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Owner-only nuclear option: wipe designs, messages, logs, stats, settings. */
export async function POST(request: Request) {
  const g = await guard("site.reset");
  if (!g.ok) return g.response;
  await resetSiteData();
  // resetSiteData clears logs — write the reset entry afterwards.
  await audit(g.session, "site.reset", "u fshi gjithë përmbajtja e website-it", clientIp(request));
  return Response.json({ ok: true });
}
