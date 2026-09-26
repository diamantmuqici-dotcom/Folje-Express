import { readMessages, writeMessages, type Message } from "@/lib/store";
import { rateLimit, tooManyRequests, clientIp } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown, max: number) {
  return typeof v === "string" ? v.replace(/\r?\n{3,}/g, "\n\n").trim().slice(0, max) : "";
}

/** Public contact / order-request endpoint. Rate limited + honeypot protected. */
export async function POST(request: Request) {
  const ip = clientIp(request);
  const limit = rateLimit(`msg:${ip}`, 5, 60 * 60_000); // 5 messages/hour/IP
  if (!limit.ok) return tooManyRequests(limit.retryAfter);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
  }

  // Honeypot: bots fill every field, humans never see this one.
  if (clean(body.company, 100)) return Response.json({ ok: true });

  const name = clean(body.name, 80);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 120);
  const message = clean(body.message, 1000);

  if (!name || (!phone && !email)) {
    return Response.json(
      { error: "Plotëso emrin dhe të paktën telefonin ose emailin." },
      { status: 400 }
    );
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "Emaili nuk është i saktë." }, { status: 400 });
  }

  const msg: Message = {
    id: crypto.randomUUID(),
    name,
    phone,
    email,
    vehicle: clean(body.vehicle, 80),
    service: clean(body.service, 80),
    designId: clean(body.designId, 64),
    message,
    status: "pending",
    createdAt: new Date().toISOString(),
    read: false,
  };

  const messages = await readMessages();
  messages.unshift(msg);
  await writeMessages(messages);
  return Response.json({ ok: true });
}
