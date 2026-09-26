import { guard } from "@/lib/auth";
import { readStats, readDesigns, readMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Session check only (no permission) so the UI can detect logged-in state;
  // the numbers themselves require stats.view.
  const g = await guard("stats.view");
  if (!g.ok) {
    // Staff still needs a lightweight "am I logged in" ping:
    const sessionCheck = await guard("messages.view");
    if (!sessionCheck.ok) return sessionCheck.response;
    return Response.json({ restricted: true });
  }
  const [stats, designs, messages] = await Promise.all([readStats(), readDesigns(), readMessages()]);
  return Response.json({
    visits: stats.visits,
    lastVisitAt: stats.lastVisitAt,
    designsTotal: designs.length,
    designsVisible: designs.filter((d) => d.visible).length,
    messagesTotal: messages.length,
    messagesUnread: messages.filter((m) => !m.read).length,
    ordersPending: messages.filter((m) => m.status === "pending").length,
    ordersAccepted: messages.filter((m) => m.status === "accepted").length,
  });
}
