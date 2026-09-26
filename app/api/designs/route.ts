import { readDesigns } from "@/lib/store";

export const dynamic = "force-dynamic";

/** Public list of visible designs, ordered by admin-controlled sort order. */
export async function GET() {
  const designs = (await readDesigns())
    .filter((d) => d.visible)
    .sort((a, b) => a.order - b.order || b.createdAt.localeCompare(a.createdAt));
  return Response.json(designs, {
    headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
  });
}
