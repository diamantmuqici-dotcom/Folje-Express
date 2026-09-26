# FOLJE EXPRESS — Automotive Wrap Studio Platform

Premium Next.js 16 website + full business backend for **Folje Express** — motorcycle
wrapping & foil studio (motorcycles and foils only: no cars, no PPF). Dark 3D design (three.js), interactive Color Lab visualizer, trilingual public
site (Albanian / English / German), team accounts with four permission roles, order inbox,
complete audit logging, DDoS / injection protection and deep SEO for
"folje", "folje express", "foljeexpress".

---

## 1. First login

On the very first start the system seeds one **Owner** account:

| Username | Password | Role |
| --- | --- | --- |
| `lorik` | `lorikfx` | Owner |

Log in at `/admin`, then open **Profili** to rename it and change the password immediately.
From **Llogaritë** you can create the rest of the team.

> Credentials are stored salted + HMAC-hashed, never in plain text. Sessions are HMAC-signed
> HttpOnly cookies (12 h). Deleting an account instantly kills its sessions.

## 2. Roles & permissions

| Ability | Staff | Admin | Co Owner | Owner |
| --- | :--: | :--: | :--: | :--: |
| View order inbox | ✔ | ✔ | ✔ | ✔ |
| Accept / decline / reopen orders | ✔ | ✔ | ✔ | ✔ |
| View stats dashboard | – | ✔ | ✔ | ✔ |
| Add / update / replace designs & prices | – | ✔ | ✔ | ✔ |
| Hide / feature / reorder designs | – | ✔ | ✔ | ✔ |
| **Delete** designs or messages | – | ✔ | – | ✔ |
| Edit site settings (texts, contacts, EN/DE copy, accent) | – | ✔ | ✔ | ✔ |
| View **audit log** | – | – | ✔ | ✔ |
| Create / edit / delete **Staff & Admin** accounts | – | – | ✔ | ✔ |
| Create / edit / delete **Co Owner & Owner** accounts | – | – | – | ✔ |
| Change own name / password | ✔ | ✔ | ✔ | ✔ |
| Wipe entire site content (reset) | – | – | – | ✔ |

Everything above is enforced **server-side** in `lib/permissions.ts` — the UI only mirrors it.

## 3. Audit log (who did what)

Every sensitive action is written to an append-only trail (newest first, 1000 entries):
logins (success, failure, throttled), logouts, design create / update / price change /
image replace / delete / hide / feature / reorder, order accept / decline / reopen,
message delete, settings update, account create / update / delete, profile change, site reset.
Each entry stores timestamp, actor, role, action, human-readable detail (e.g. old → new price)
and the source IP. Visible only to **Co Owner** and **Owner**.

## 4. Routes

| Route | Purpose |
| --- | --- |
| `/` | Public trilingual 3D website (SQ / EN / DE switcher, remembers choice) |
| `/admin` | Team panel: orders, designs, settings, accounts, audit log, profile |
| `/api/designs` · `/api/settings` | Public content APIs |
| `/api/messages` | Public order requests (rate limited + honeypot) |
| `/api/track` | Anonymous visit beacon for stats |
| `/api/admin/me` | Session bootstrap for the panel |
| `/api/admin/login` · `/logout` | Account auth (throttled per IP and per username) |
| `/api/admin/designs` | Product CRUD with role checks + audit |
| `/api/admin/messages` | Inbox: accept / decline / read / delete + audit |
| `/api/admin/settings` | Site identity incl. EN/DE hero copy + audit |
| `/api/admin/stats` | Visits, orders, designs, messages |
| `/api/admin/accounts` | Team management (role-limited) + audit |
| `/api/admin/logs` | Audit trail (Co Owner / Owner) |
| `/api/admin/profile` | Self-service rename / password change |
| `/api/admin/reset` | Owner-only content wipe |
| `/sitemap.xml` · `/robots.txt` · `/manifest.webmanifest` | SEO + PWA |

## 5. Design & 3D

- Hero: chrome torus-knot sculpture, particle field, orbit rings, mouse parallax (three.js)
- **Color Lab**: drag-to-rotate 3D body panel with 8 live foil finishes (gloss/matte/satin/chrome/flip/gold…)
- Tilt cards with hover glare, animated foil swatches, scroll reveals, marquee
- All scenes pause on hidden tabs and honour `prefers-reduced-motion`
- **No emoji / icons anywhere** — typography-only interface

## 6. Security

- `middleware.ts`: global per-IP flood limit (600 req/min) + per-route caps, malicious
  scanner/bot UA blocking, SQL-injection & path-traversal pattern blocking (URL-decoded),
  CSP / HSTS / X-Frame-Options / Referrer-Policy / Permissions-Policy headers
- Login brute-force throttle (per IP + per username), salted HMAC password hashes,
  constant-time compares, HMAC-signed session cookies
- Contact form honeypot + validation; uploads type/size checked, UUID names, traversal-safe deletes
- On Vercel this layer combines with the platform edge protection; put Cloudflare/WAF in front
  for enterprise-grade mitigation without code changes

## 7. Storage

- **Production (Vercel):** set `BLOB_READ_WRITE_TOKEN` → JSON data private in Vercel Blob,
  product photos as public Blob URLs.
- **Development:** automatic local fallback (`./data/*.json`, `./public/uploads`), git-ignored.
- Bundled media lives in `./public/media`:
  - `forged-carbon-wrap.jpg` — the 50€ starter product photo
  - `profile-logo.png` — square avatar for TikTok / Instagram / Facebook profiles (@foljeexpress)

## 8. Setup & deploy

```bash
npm install
cp .env.example .env.local   # optional in dev
npm run dev                  # http://localhost:3000  →  /admin (lorik / lorikfx)
```

Deploy: import the repo into **Vercel**, add env vars (`BLOB_READ_WRITE_TOKEN`,
`NEXT_PUBLIC_SITE_URL`). The GitHub Pages workflow publishes the standalone `index.html`
as a static SEO fallback.

After deploying, submit the domain in Google Search Console and request indexing so
"folje express" searches find the site quickly.

## 9. Catalogue seed

The starter product **Forged Carbon Shield — 50€** (recreation of the real scooter wrap,
forged-carbon marble pattern on the centre panels) ships in `public/media` and appears
automatically until you publish your own designs.

Business scope is **motorcycles + foils only** (categories: Motoçikleta / Folje). Every filter
view also shows a permanent **custom order card** so visitors can always request a custom
design via WhatsApp or the contact form. Socials default to TikTok & Instagram @foljeexpress.
