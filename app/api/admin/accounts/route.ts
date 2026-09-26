import { guard, createAccount, updateAccount, deleteAccount } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";
import { readAccounts } from "@/lib/store";
import { creatableRoles, ROLE_LABELS, type Role } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safe(a: { id: string; username: string; role: Role; createdAt: string; createdBy: string }) {
  return { id: a.id, username: a.username, role: a.role, createdAt: a.createdAt, createdBy: a.createdBy };
}

/** List accounts (Co Owner & Owner). Never exposes hashes. */
export async function GET() {
  const g = await guard("accounts.view");
  if (!g.ok) return g.response;
  const accounts = await readAccounts();
  return Response.json(
    { accounts: accounts.map(safe), creatable: creatableRoles(g.session.role), labels: ROLE_LABELS },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/** Create an account. Role limits enforced server-side. */
export async function POST(request: Request) {
  const g = await guard("accounts.manage");
  if (!g.ok) return g.response;
  const { username, password, role } = await request.json().catch(() => ({}));
  const result = await createAccount(g.session, String(username || ""), String(password || ""), role as Role);
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  await audit(g.session, "account.create", `+ ${result.account.username} (${ROLE_LABELS[result.account.role]})`, clientIp(request));
  return Response.json(safe(result.account));
}

/** Update username / password / role of an account. */
export async function PATCH(request: Request) {
  const g = await guard("accounts.manage");
  if (!g.ok) return g.response;
  const { id, username, password, role } = await request.json().catch(() => ({}));
  const result = await updateAccount(g.session, String(id || ""), {
    username: typeof username === "string" ? username : undefined,
    password: typeof password === "string" ? password : undefined,
    role: typeof role === "string" ? (role as Role) : undefined,
  });
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  await audit(g.session, "account.update", `${result.account.username}: ${[username && "emri", password && "fjalëkalimi", role && "roli"].filter(Boolean).join(", ")}`, clientIp(request));
  return Response.json(safe(result.account));
}

export async function DELETE(request: Request) {
  const g = await guard("accounts.manage");
  if (!g.ok) return g.response;
  const accounts = await readAccounts();
  const { id } = await request.json().catch(() => ({}));
  const target = accounts.find((a) => a.id === id);
  const result = await deleteAccount(g.session, String(id || ""));
  if ("error" in result) return Response.json({ error: result.error }, { status: result.status });
  await audit(g.session, "account.delete", `- ${target?.username || id} (${target ? ROLE_LABELS[target.role] : "?"})`, clientIp(request));
  return Response.json({ ok: true });
}
