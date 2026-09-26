import { cookies } from "next/headers";
import { rateLimit } from "./ratelimit";

const COOKIE = "folje_admin";
const TTL = 1000 * 60 * 60 * 12;

async function sign(value: string) {
  const secret = process.env.ADMIN_PASSWORD;
  if (!secret) throw new Error("ADMIN_PASSWORD is not configured");
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

async function validToken(token: string) {
  const [ts, sig] = token.split(".");
  const time = Number(ts);
  if (!ts || !sig || !Number.isFinite(time) || Date.now() - time > TTL || Date.now() < time) return false;
  const expected = await sign(ts);
  // Constant-time compare to avoid timing attacks.
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export async function isAdmin() {
  const token = (await cookies()).get(COOKIE)?.value;
  return !!token && (await validToken(token));
}

/**
 * Attempt a login. Brute-force protected: max 6 attempts per 15 minutes per
 * IP, and max 30 per day per IP regardless of correctness.
 */
export async function login(password: string, ip: string) {
  const short = rateLimit(`login:short:${ip}`, 6, 15 * 60_000);
  const long = rateLimit(`login:long:${ip}`, 30, 24 * 60 * 60_000);
  if (!short.ok || !long.ok) {
    return { ok: false, throttled: true, retryAfter: Math.max(short.retryAfter, long.retryAfter) };
  }
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { ok: false, throttled: false, retryAfter: 0, notConfigured: true };
  if (typeof password !== "string" || password.length > 200 || password !== expected) {
    return { ok: false, throttled: false, retryAfter: 0 };
  }
  const ts = String(Date.now());
  const token = ts + "." + (await sign(ts));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return { ok: true, throttled: false, retryAfter: 0 };
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
