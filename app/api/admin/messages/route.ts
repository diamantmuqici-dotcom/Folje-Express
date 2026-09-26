import { guard } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";
import { readMessages, writeMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Order inbox — every role can view. */
export async function GET() {
  const g = await guard("messages.view");
  if (!g.ok) return g.response;
  return Response.json(await readMessages(), { headers: { "Cache-Control": "no-store" } });
}

/**
 * PATCH body: { id, read? } or { id, status: "accepted" | "declined" | "pending" }
 * Accepting / declining an order is allowed for every role (Staff's core job).
 */
export async function PATCH(request: Request) {
  const g = await guard("messages.view");
  if (!g.ok) return g.response;
  const { id, read, status } = await request.json().catch(() => ({}));
  const messages = await readMessages();
  const item = messages.find((m) => m.id === id);
  if (!item) return Response.json({ error: "Mesazhi nuk u gjet." }, { status: 404 });

  if (typeof read === "boolean") item.read = read;

  if (typeof status === "string" && status !== item.status) {
    const decide = await guard("messages.decide");
    if (!decide.ok) return decide.response;
    if (!["pending", "accepted", "declined"].includes(status)) {
      return Response.json({ error: "Status i pavlefshëm." }, { status: 400 });
    }
    item.status = status as typeof item.status;
    await audit(g.session, status === "accepted" ? "order.accept" : status === "declined" ? "order.decline" : "order.reopen", `porosia e "${item.name}"`, clientIp(request));
  }

  await writeMessages(messages);
  return Response.json(item);
}

/** Delete a message — Admin & Owner only. */
export async function DELETE(request: Request) {
  const g = await guard("messages.delete");
  if (!g.ok) return g.response;
  const { id } = await request.json().catch(() => ({}));
  const messages = await readMessages();
  const item = messages.find((m) => m.id === id);
  if (!item) return Response.json({ error: "Mesazhi nuk u gjet." }, { status: 404 });
  await writeMessages(messages.filter((m) => m.id !== id));
  await audit(g.session, "message.delete", `mesazhi i "${item.name}"`, clientIp(request));
  return Response.json({ ok: true });
}
