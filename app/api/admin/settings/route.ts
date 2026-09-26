import { isAdmin } from "@/lib/auth";
import { readSettings, writeSettings, defaultSettings, type SiteSettings } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Nuk je i autorizuar." }, { status: 401 });
}

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(await readSettings(), { headers: { "Cache-Control": "no-store" } });
}

/** Update any subset of the public site settings. */
export async function PUT(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  }
  const current = await readSettings();
  const next: SiteSettings = { ...current };
  for (const key of Object.keys(defaultSettings) as (keyof SiteSettings)[]) {
    const value = (body as Record<string, unknown>)[key];
    if (typeof value === "string") next[key] = value.trim().slice(0, key === "about" || key === "heroSubtitle" ? 600 : 200);
  }
  if (next.accent && !/^#[0-9a-fA-F]{6}$/.test(next.accent)) next.accent = current.accent;
  await writeSettings(next);
  return Response.json(next);
}
