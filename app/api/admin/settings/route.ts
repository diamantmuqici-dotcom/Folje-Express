import { guard } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";
import { readSettings, writeSettings, defaultSettings, type SiteSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const g = await guard("settings.view");
  if (!g.ok) return g.response;
  return Response.json(await readSettings(), { headers: { "Cache-Control": "no-store" } });
}

/** Update any subset of the public site settings. */
export async function PUT(request: Request) {
  const g = await guard("settings.update");
  if (!g.ok) return g.response;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });

  const current = await readSettings();
  const next: SiteSettings = { ...current };
  const changed: string[] = [];
  for (const key of Object.keys(defaultSettings) as (keyof SiteSettings)[]) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string" && value.trim() !== current[key]) {
      next[key] = value.trim().slice(0, key.includes("Subtitle") || key === "about" || key === "aboutEn" || key === "aboutDe" ? 600 : 200);
      changed.push(key);
    }
  }
  if (next.accent && !/^#[0-9a-fA-F]{6}$/.test(next.accent)) next.accent = current.accent;
  if (changed.length === 0) return Response.json(next);
  await writeSettings(next);
  await audit(g.session, "settings.update", `fushat: ${changed.join(", ")}`, clientIp(request));
  return Response.json(next);
}
