import { cookies } from "next/headers";
import { rateLimit } from "./ratelimit";
import { readAccounts, readSecret, writeAccounts, hashPassword, makeAccount, type Account } from "./store";
import { can, canManageAccount, type Role } from "./permissions";

const COOKIE = "folje_admin";
const TTL = 1000 * 60 * 60 * 12; // 12h

export type Session = { username: string; role: Role };

async function sign(value: string) {
  const secret = await readSecret();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Buffer.from(sig).toString("base64url");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [username, role, exp, sig] = parts;
  const expiry = Number(exp);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  const expected = await sign(`${username}.${role}.${exp}`);
  if (!safeEqual(expected, sig)) return null;
  // The account must still exist (deleting an account kills its sessions).
  const accounts = await readAccounts();
  const account = accounts.find((a) => a.username === username);
  if (!account || account.role !== role) return null;
  return { username: account.username, role: account.role };
}

export async function login(username: string, password: string, ip: string) {
  const short = rateLimit(`login:short:${ip}`, 6, 15 * 60_000);
  const long = rateLimit(`login:long:${ip}`, 30, 24 * 60 * 60_000);
  const perUser = rateLimit(`login:user:${String(username).toLowerCase()}`, 8, 15 * 60_000);
  if (!short.ok || !long.ok || !perUser.ok) {
    return { ok: false as const, throttled: true, retryAfter: Math.max(short.retryAfter, long.retryAfter, perUser.retryAfter) };
  }
  const cleanUser = String(username || "").trim().toLowerCase().slice(0, 40);
  if (!cleanUser || typeof password !== "string" || password.length > 200) {
    return { ok: false as const, throttled: false, retryAfter: 0 };
  }
  const accounts = await readAccounts();
  const account = accounts.find((a) => a.username === cleanUser);
  if (!account) return { ok: false as const, throttled: false, retryAfter: 0 };
  const hash = await hashPassword(password, account.salt);
  if (!safeEqual(hash, account.passHash)) return { ok: false as const, throttled: false, retryAfter: 0 };

  const exp = String(Date.now() + TTL);
  const token = `${account.username}.${account.role}.${exp}.${await sign(`${account.username}.${account.role}.${exp}`)}`;
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL / 1000,
  });
  return { ok: true as const, throttled: false, retryAfter: 0, account };
}

export async function logout() {
  (await cookies()).set(COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/* ------------------------------------------------------------------ */
/* Route guards                                                        */
/* ------------------------------------------------------------------ */

export type Guard =
  | { ok: true; session: Session }
  | { ok: false; response: Response };

/** Requires a logged-in session with permission for `action`. */
export async function guard(action: string): Promise<Guard> {
  const session = await getSession();
  if (!session) {
    return { ok: false, response: Response.json({ error: "Nuk je i autorizuar." }, { status: 401 }) };
  }
  if (!can(session.role, action)) {
    return { ok: false, response: Response.json({ error: "Roli yt nuk ka të drejtë për këtë veprim." }, { status: 403 }) };
  }
  return { ok: true, session };
}

/* ------------------------------------------------------------------ */
/* Account management helpers (used by /api/admin/accounts)            */
/* ------------------------------------------------------------------ */

export async function createAccount(actor: Session, username: string, password: string, role: Role) {
  if (!canManageAccount(actor.role, role, "create")) {
    return { error: "Nuk mund të krijosh llogari me këtë rol." , status: 403 };
  }
  const clean = username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
  if (clean.length < 3) return { error: "Emri duhet të ketë të paktën 3 shkronja (a-z, 0-9).", status: 400 };
  if (password.length < 6) return { error: "Fjalëkalimi duhet të ketë të paktën 6 shkronja.", status: 400 };
  const accounts = await readAccounts();
  if (accounts.some((a) => a.username === clean)) return { error: "Ky emër përdorimi ekziston déjà.", status: 409 };
  const account = await makeAccount(clean, password, role, actor.username);
  accounts.push(account);
  await writeAccounts(accounts);
  return { account, status: 200 };
}

export async function updateAccount(actor: Session, id: string, patch: { username?: string; password?: string; role?: Role }) {
  const accounts = await readAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) return { error: "Llogaria nuk u gjet.", status: 404 };
  if (!canManageAccount(actor.role, target.role, "update")) {
    return { error: "Nuk mund të ndryshosh këtë llogari.", status: 403 };
  }
  if (patch.role && patch.role !== target.role) {
    if (!canManageAccount(actor.role, patch.role, "create")) {
      return { error: "Nuk mund të japësh këtë rol.", status: 403 };
    }
    if (target.role === "owner" && !accounts.some((a) => a.role === "owner" && a.id !== target.id)) {
      return { error: "Nuk mund të heqësh rolin e fundit Owner.", status: 400 };
    }
    target.role = patch.role;
  }
  if (typeof patch.username === "string" && patch.username.trim()) {
    const clean = patch.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
    if (clean.length < 3) return { error: "Emri i papranueshëm.", status: 400 };
    if (accounts.some((a) => a.username === clean && a.id !== target.id)) return { error: "Emri është i zënë.", status: 409 };
    target.username = clean;
  }
  if (typeof patch.password === "string" && patch.password.length >= 6) {
    target.salt = crypto.randomUUID();
    target.passHash = await hashPassword(patch.password, target.salt);
  }
  await writeAccounts(accounts);
  return { account: target, status: 200 };
}

export async function deleteAccount(actor: Session, id: string) {
  const accounts = await readAccounts();
  const target = accounts.find((a) => a.id === id);
  if (!target) return { error: "Llogaria nuk u gjet.", status: 404 };
  if (target.username === actor.username) return { error: "Nuk mund të fshish llogarinë tënde.", status: 400 };
  if (!canManageAccount(actor.role, target.role, "delete")) {
    return { error: "Nuk mund të fshish këtë llogari.", status: 403 };
  }
  if (target.role === "owner" && !accounts.some((a) => a.role === "owner" && a.id !== target.id)) {
    return { error: "Duhet të mbetet të paktën një Owner.", status: 400 };
  }
  await writeAccounts(accounts.filter((a) => a.id !== id));
  return { status: 200 };
}

/** Change the logged-in user's own username / password. */
export async function updateOwnAccount(actor: Session, patch: { username?: string; password?: string; currentPassword?: string }) {
  const accounts = await readAccounts();
  const me = accounts.find((a) => a.username === actor.username);
  if (!me) return { error: "Llogaria nuk u gjet.", status: 404 };
  if (patch.password) {
    const currentHash = await hashPassword(String(patch.currentPassword || ""), me.salt);
    if (!safeEqual(currentHash, me.passHash)) return { error: "Fjalëkalimi aktual nuk është i saktë.", status: 403 };
    if (patch.password.length < 6) return { error: "Fjalëkalimi i ri duhet të ketë 6+ shkronja.", status: 400 };
    me.salt = crypto.randomUUID();
    me.passHash = await hashPassword(patch.password, me.salt);
  }
  if (patch.username && patch.username.trim()) {
    const clean = patch.username.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 40);
    if (clean.length < 3) return { error: "Emri i papranueshëm.", status: 400 };
    if (accounts.some((a) => a.username === clean && a.id !== me.id)) return { error: "Emri është i zënë.", status: 409 };
    me.username = clean;
  }
  await writeAccounts(accounts);
  return { account: me, status: 200 };
}

export type { Account };
