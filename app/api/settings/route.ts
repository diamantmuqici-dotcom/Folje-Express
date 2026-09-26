import { readSettings } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public site settings (contact info, hero copy, accent colour...). */
export async function GET() {
  return Response.json(await readSettings(), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
