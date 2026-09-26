import { isAdmin } from "@/lib/auth";
import { readStats, readDesigns, readMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) {
    return Response.json({ error: "Nuk je i autorizuar." }, { status: 401 });
  }
  const [stats, designs, messages] = await Promise.all([readStats(), readDesigns(), readMessages()]);
  return Response.json({
    visits: stats.visits,
    lastVisitAt: stats.lastVisitAt,
    designsTotal: designs.filter((d) => !d.id.startsWith("demo-")).length,
    designsVisible: designs.filter((d) => d.visible && !d.id.startsWith("demo-")).length,
    messagesTotal: messages.length,
    messagesUnread: messages.filter((m) => !m.read).length,
  });
}
