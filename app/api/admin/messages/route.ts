import { isAdmin } from "@/lib/auth";
import { readMessages, writeMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return Response.json({ error: "Nuk je i autorizuar." }, { status: 401 });
}

export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  return Response.json(await readMessages(), { headers: { "Cache-Control": "no-store" } });
}

/** Mark a message as read/unread: { id, read } */
export async function PATCH(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { id, read } = await request.json().catch(() => ({}));
  const messages = await readMessages();
  const item = messages.find((m) => m.id === id);
  if (!item) return Response.json({ error: "Mesazhi nuk u gjet." }, { status: 404 });
  item.read = !!read;
  await writeMessages(messages);
  return Response.json(item);
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await request.json().catch(() => ({}));
  const messages = await readMessages();
  if (!messages.some((m) => m.id === id)) {
    return Response.json({ error: "Mesazhi nuk u gjet." }, { status: 404 });
  }
  await writeMessages(messages.filter((m) => m.id !== id));
  return Response.json({ ok: true });
}
