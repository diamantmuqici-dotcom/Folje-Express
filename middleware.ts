import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/ratelimit";

/* ------------------------------------------------------------------ */
/* FOLJE EXPRESS security middleware                                   */
/*  - Per-IP sliding-window rate limiting (flood / DDoS mitigation)    */
/*  - Malicious scanner & bot user-agent blocking                      */
/*  - SQL-injection / path-traversal pattern blocking on APIs          */
/*  - Security headers on every response                               */
/* ------------------------------------------------------------------ */

const BLOCKED_UA = [
  "sqlmap", "nikto", "nmap", "masscan", "zgrab", "fscan", "xenu", "havij",
  "acunetix", "nessus", "openvas", "wpscan", "dirbuster", "gobuster", "ffuf",
  "hydra", "metasploit", "curl/7", "python-urllib", "scrapy", "httpunit", "nutch",
  "phpcrawl", "baiduspider-", "petalbot", "bytespider", "semrush", "ahrefsbot",
  "mj12bot", "dotbot", "blexbot", "dataforseo", "seekport",
];

const BLOCKED_QUERY = /(\b(union\s+select|select\s+.*\s+from|drop\s+table|insert\s+into|delete\s+from|update\s+.*\s+set|sleep\s*\(|benchmark\s*\(|load_file|information_schema)\b|(<script|--\s|\/etc\/passwd|\.\.\/))/i;

function securityHeaders(response: NextResponse) {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ")
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  return response;
}

function ipOf(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  const ip = ipOf(request);

  /* 1. Block known malicious scanners / abusive bots outright. */
  if (BLOCKED_UA.some((bad) => ua.includes(bad))) {
    return securityHeaders(new NextResponse("Forbidden", { status: 403 }));
  }

  /* 2. Block obvious injection payloads aimed at the API. */
  let decodedSearch = search;
  try {
    decodedSearch = decodeURIComponent(search.replace(/\+/g, " "));
  } catch {
    /* malformed encoding — test the raw string */
  }
  if (pathname.startsWith("/api") && (BLOCKED_QUERY.test(search) || BLOCKED_QUERY.test(decodedSearch))) {
    return securityHeaders(
      NextResponse.json({ error: "Kërkesë e pavlefshme." }, { status: 400 })
    );
  }

  /* 3. Rate limits — one global flood limit plus stricter per-route caps. */
  const global = rateLimit(`g:${ip}`, 600, 60_000); // max 600 req/min per IP, anything
  if (!global.ok) return flood(global.retryAfter);

  let limit: { ok: boolean; retryAfter: number } | null = null;
  if (pathname === "/api/admin/login") {
    limit = rateLimit(`rl:login:${ip}`, 10, 15 * 60_000);
  } else if (pathname === "/api/messages") {
    limit = rateLimit(`rl:msg:${ip}`, 10, 60 * 60_000);
  } else if (pathname === "/api/track") {
    limit = rateLimit(`rl:track:${ip}`, 6, 60 * 60_000);
  } else if (pathname.startsWith("/api/admin")) {
    limit = rateLimit(`rl:admin:${ip}`, 240, 60_000);
  } else if (pathname.startsWith("/api")) {
    limit = rateLimit(`rl:api:${ip}`, 120, 60_000);
  } else {
    limit = rateLimit(`rl:page:${ip}`, 300, 60_000);
  }
  if (limit && !limit.ok) return flood(limit.retryAfter);

  /* 4. Attach security headers to everything that passes. */
  return securityHeaders(NextResponse.next());
}

function flood(retryAfter: number) {
  const response = new NextResponse(
    JSON.stringify({ error: "Shumë kërkesa nga ky IP. Provo përsëri pas pak." }),
    {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    }
  );
  return securityHeaders(response);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/|logo.png|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico).*)"],
};
