# FOLJE EXPRESS 🚗✨

Premium Next.js 16 website + full backend for **Folje Express** — an automotive foil / car-wrap studio.
Dark 3D design (three.js), interactive Color Lab visualizer, private admin panel, contact inbox,
visit stats, built-in DDoS/abuse protection and full Albanian SEO ("folje", "folje express", "foljeexpress").

## Routes

| Route | What it is |
| --- | --- |
| `/` | Public 3D website (hero scene, design library w/ search & filters, Color Lab 3D, process, contact form) |
| `/admin` | Private panel: products, prices, photos, ordering, messages inbox, site settings, stats |
| `/api/designs` | Public published-design API |
| `/api/settings` | Public site settings API |
| `/api/messages` | Public contact/order requests (rate limited + honeypot) |
| `/api/track` | Anonymous visit beacon (feeds admin stats) |
| `/api/admin/login` · `/logout` | Session auth (HMAC cookie, brute-force throttled) |
| `/api/admin/designs` | CRUD: create, update price/title/description/category/badge, replace image, feature, hide, reorder, delete |
| `/api/admin/settings` | Read/update hero copy, contact info, socials, accent colour |
| `/api/admin/messages` | Inbox: list, mark read, delete |
| `/api/admin/stats` | Visits, design & message counters |
| `/sitemap.xml` · `/robots.txt` · `/manifest.webmanifest` | SEO + PWA |

## What the admin can do

- **Add products** with photo, price, description, category, badge ("E RE", "POPULLOR"…)
- **Change price / title / description** of any product at any time (edit modal)
- **Replace the photo** of an existing product
- **Delete products**, **hide/show** them, mark them **★ featured**
- **Reorder** products with ↑/↓ buttons
- **Read customer messages** from the contact form (with WhatsApp shortcut, read/unread, delete)
- **Edit the whole website identity**: business name, tagline, phone, WhatsApp, Instagram, TikTok,
  email, address, opening hours, hero headline/subtitle, about text and the **accent colour**
- **See stats**: unique visits, visible designs, message counts

## Security / DDoS protection

- `middleware.ts` runs on every request:
  - global per-IP flood limit (600 req/min) + stricter limits per route (pages, API, admin, login, contact, tracking)
  - blocks known malicious scanner/bot user agents (sqlmap, nikto, zgrab, hydra, …)
  - blocks SQL-injection / path-traversal patterns aimed at the API
  - attaches security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy
- Admin login: HMAC-signed HttpOnly cookie + per-IP brute-force throttle (6 tries/15 min, 30/day)
- Contact form: honeypot field + per-IP limit + server-side validation & sanitising
- Uploads: type-checked, size-capped (12 MB), random UUID filenames, traversal-safe deletion

> On serverless (Vercel) the in-memory limiter is per instance; it is a strong first layer and
> combines with Vercel's own edge protection. For heavy traffic you can add Vercel WAF /
> Cloudflare in front without code changes.

## Storage

- **Production (Vercel):** set `BLOB_READ_WRITE_TOKEN` → data JSON lives privately in Vercel Blob,
  product photos are public Blob URLs.
- **Development / any Node host:** without the token the app automatically falls back to local
  files — `./data/*.json` (git-ignored) and `./public/uploads` for photos. Everything works,
  nothing extra to install.

## Setup

1. `npm install`
2. Copy `.env.example` → `.env.local` and set at least `ADMIN_PASSWORD`.
3. `npm run dev` → open http://localhost:3000 and `/admin`.
4. Deploy: import the repo into **Vercel** (auto-detected Next.js), add a Blob store (optional)
   and the env vars (`ADMIN_PASSWORD`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_SITE_URL`).

The GitHub Pages workflow still deploys the standalone `index.html` as a static SEO fallback site.

## SEO

- Keyword-targeted metadata & Open Graph for: *folje, folje express, foljeexpress, folje makinash,
  car wrap, vinyl wrap, ndërrim ngjyre, wrap Kosovë…*
- `AutoBusiness` JSON-LD structured data (name, alternates, phone, address, hours, services)
- `sitemap.xml`, `robots.txt`, web manifest (installable PWA), semantic Albanian content,
  descriptive alt text, fast LCP (lazy images, suspended 3D when tab hidden / reduced motion).

After deploying, submit the site in [Google Search Console](https://search.google.com/search-console)
and request indexing for the homepage so "folje express" searches find it quickly.
