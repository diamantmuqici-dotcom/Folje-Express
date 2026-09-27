import { promises as fs } from "fs";
import path from "path";
import type { Role } from "./permissions";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Category = "Motoçikleta" | "Folje";
export const CATEGORIES: Category[] = ["Motoçikleta", "Folje"];

export type Design = {
  id: string;
  title: string;
  price: string;
  description: string;
  category: Category;
  image: string;
  badge: string;
  featured: boolean;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
  order: number;
};

export type SiteSettings = {
  businessName: string;
  tagline: string;
  phone: string;
  whatsapp: string;
  instagram: string;
  tiktok: string;
  email: string;
  address: string;
  hours: string;
  heroEyebrow: string;
  heroTitle: string;
  heroHighlight: string;
  heroSubtitle: string;
  heroTitleEn: string;
  heroHighlightEn: string;
  heroSubtitleEn: string;
  heroTitleDe: string;
  heroHighlightDe: string;
  heroSubtitleDe: string;
  about: string;
  aboutEn: string;
  aboutDe: string;
  accent: string;
};

export type OrderStatus = "pending" | "accepted" | "declined";

export type Message = {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  service: string;
  designId: string;
  message: string;
  status: OrderStatus;
  createdAt: string;
  read: boolean;
};

export type Account = {
  id: string;
  username: string;
  salt: string;
  passHash: string;
  role: Role;
  createdAt: string;
  createdBy: string;
};

export type LogEntry = {
  id: string;
  at: string;
  actor: string;
  role: string;
  action: string;
  detail: string;
  ip: string;
};

export type Stats = {
  visits: number;
  messagesSent: number;
  lastVisitAt: string;
};

/* ------------------------------------------------------------------ */
/* Storage backend: Vercel Blob when configured, local files in dev.   */
/* ------------------------------------------------------------------ */

const DATA_DIR_BASE = path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function hasBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * On Vercel the filesystem is read-only/ephemeral. Without a Blob token we
 * fall back to /tmp so the panel still works between restarts of an instance;
 * add a Vercel Blob store for permanent storage (README, section 7).
 */
function dataDir() {
  if (!hasBlob() && process.env.VERCEL) return "/tmp/folje-data";
  return DATA_DIR_BASE;
}

const DATA_DIR = dataDir();

async function readText(blobPath: string, filePath: string): Promise<string | null> {
  if (hasBlob()) {
    try {
      const { get } = await import("@vercel/blob");
      const result = await get(blobPath, { access: "private", useCache: false });
      if (!result) return null;
      return await new Response(result.stream).text();
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function writeText(blobPath: string, filePath: string, text: string) {
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(blobPath, text, { access: "private", allowOverwrite: true });
    return;
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

async function readJSON<T>(blobPath: string, filePath: string, fallback: T): Promise<T> {
  const text = await readText(blobPath, filePath);
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJSON(blobPath: string, filePath: string, data: unknown) {
  await writeText(blobPath, filePath, JSON.stringify(data, null, 2));
}

/* ------------------------------------------------------------------ */
/* Images                                                              */
/* ------------------------------------------------------------------ */

export async function saveImage(file: File): Promise<string> {
  if (!hasBlob() && process.env.VERCEL) {
    throw new Error("Upload-et e fotove kërkojnë Vercel Blob: shto BLOB_READ_WRITE_TOKEN te Vercel → Settings → Storage.");
  }
  const ext = (file.name.split(".").pop() || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase() || "jpg";
  const name = `${crypto.randomUUID()}.${ext}`;
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(`designs/${name}`, file, { access: "public", addRandomSuffix: false });
    return blob.url;
  }
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

export async function removeImage(url: string) {
  if (!url) return;
  try {
    if (url.startsWith("/uploads/")) {
      const name = path.basename(url); // traversal-safe
      await fs.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
      return;
    }
    if (hasBlob() && url.startsWith("http")) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
    /* /media/* seeds are static assets — never deleted */
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Designs                                                             */
/* ------------------------------------------------------------------ */

const DESIGNS_BLOB = "data/designs.json";
const DESIGNS_FILE = path.join(DATA_DIR, "designs.json");

/** Starter catalogue — the real forged-carbon scooter work (50€). */
const seedDesigns: Design[] = [
  {
    id: "seed-forged-carbon",
    title: "Forged Carbon Shield",
    price: "50€",
    description:
      "Folie forged carbon me efekt mermeri, e aplikuar në panelin qendror të motoçikletës — punim real nga studioja jonë. Mbrojtje ndaj gërvishtjeve me shkëlqim të thellë gloss.",
    category: "Motoçikleta",
    image: "/media/forged-carbon-wrap.jpg",
    badge: "PUNIM REAL",
    featured: true,
    visible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    order: 0,
  },
];

function normalizeDesign(raw: Partial<Design>, index: number): Design {
  return {
    id: String(raw.id || crypto.randomUUID()),
    title: String(raw.title || "Pa titull"),
    price: String(raw.price || "Na kontakto"),
    description: String(raw.description || ""),
    category: CATEGORIES.includes(raw.category as Category) ? (raw.category as Category) : "Motoçikleta",
    image: String(raw.image || ""),
    badge: String(raw.badge || ""),
    featured: raw.featured === true,
    visible: raw.visible !== false,
    createdAt: String(raw.createdAt || new Date().toISOString()),
    updatedAt: String(raw.updatedAt || raw.createdAt || new Date().toISOString()),
    order: typeof raw.order === "number" ? raw.order : index,
  };
}

export async function readDesigns(): Promise<Design[]> {
  const data = await readJSON<unknown>(DESIGNS_BLOB, DESIGNS_FILE, null);
  // Clone seeds so callers can never mutate the module-level defaults.
  if (!Array.isArray(data) || data.length === 0) return seedDesigns.map((d) => ({ ...d }));
  return data.map((d, i) => normalizeDesign(d as Partial<Design>, i));
}

export async function writeDesigns(data: Design[]) {
  await writeJSON(DESIGNS_BLOB, DESIGNS_FILE, data);
}

/* ------------------------------------------------------------------ */
/* Site settings                                                       */
/* ------------------------------------------------------------------ */

const SETTINGS_BLOB = "data/settings.json";
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");

export const defaultSettings: SiteSettings = {
  businessName: "FOLJE EXPRESS",
  tagline: "Motorcycle Wrap Studio",
  phone: "+383 49 000 000",
  whatsapp: "+383 43 977 882",
  instagram: "foljeexpress",
  tiktok: "foljeexpress",
  email: "info@foljeexpress.com",
  address: "Prishtinë, Kosovë",
  hours: "E Hënë – E Shtunë · 09:00 – 19:00",
  heroEyebrow: "FOLJE EXPRESS / MOTORCYCLE WRAP STUDIO",
  heroTitle: "Ndrysho",
  heroHighlight: "pamjen.",
  heroSubtitle:
    "Folie premium me ngjyra dhe dizajne për motoçikleta. Një pamje e re, e ndërtuar rreth stilit tënd — nga Folje Express, për një rezultat që dallohet.",
  heroTitleEn: "Change",
  heroHighlightEn: "the look.",
  heroSubtitleEn:
    "Premium coloured foils and designs for motorcycles. A new look built around your style — by Folje Express, for a result that stands out.",
  heroTitleDe: "Verändere",
  heroHighlightDe: "den Look.",
  heroSubtitleDe:
    "Premium-Folien in Farben und Designs für Motorräder. Ein neuer Look, gebaut um deinen Stil — von Folje Express, für ein Ergebnis das auffällt.",
  about:
    "Folje Express është studio e specializuar për folie motoçikletash: ndërrim ngjyre, dizajne custom dhe detaje me folje premium për motorin tënd. Çdo punim bëhet me materiale premium dhe përfundim të pastër.",
  aboutEn:
    "Folje Express is a studio specialised in motorcycle wrapping: colour changes, custom designs and premium foil details for your bike. Every job is done with premium materials and a clean finish.",
  aboutDe:
    "Folje Express ist ein Studio für Motorrad-Folierung: Farbwechsel, eigene Designs und Premium-Foliendetails für dein Bike. Jeder Auftrag wird mit Premium-Materialien und sauberem Finish ausgeführt.",
  accent: "#5bc7ff",
};

/* The placeholder WhatsApp line that shipped before the studio published its
   real number. Stored settings would otherwise keep overriding the default,
   which would leave the WhatsApp buttons pointing at a dead number. */
const LEGACY_WHATSAPP = new Set(["+38349000000", "38349000000"]);

export async function readSettings(): Promise<SiteSettings> {
  const data = await readJSON<Partial<SiteSettings>>(SETTINGS_BLOB, SETTINGS_FILE, {});
  const merged = { ...defaultSettings, ...data };
  const stored = String(data.whatsapp || "").replace(/[^0-9+]/g, "");
  if (stored && LEGACY_WHATSAPP.has(stored)) merged.whatsapp = defaultSettings.whatsapp;
  return merged;
}

export async function writeSettings(settings: SiteSettings) {
  await writeJSON(SETTINGS_BLOB, SETTINGS_FILE, settings);
}

/* ------------------------------------------------------------------ */
/* Messages / orders                                                   */
/* ------------------------------------------------------------------ */

const MESSAGES_BLOB = "data/messages.json";
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

export async function readMessages(): Promise<Message[]> {
  const data = await readJSON<unknown>(MESSAGES_BLOB, MESSAGES_FILE, []);
  if (!Array.isArray(data)) return [];
  return (data as Partial<Message>[]).map((m) => ({
    id: String(m.id || crypto.randomUUID()),
    name: String(m.name || ""),
    phone: String(m.phone || ""),
    email: String(m.email || ""),
    vehicle: String(m.vehicle || ""),
    service: String(m.service || ""),
    designId: String(m.designId || ""),
    message: String(m.message || ""),
    status: m.status === "accepted" || m.status === "declined" ? m.status : "pending",
    createdAt: String(m.createdAt || new Date().toISOString()),
    read: m.read === true,
  }));
}

export async function writeMessages(messages: Message[]) {
  await writeJSON(MESSAGES_BLOB, MESSAGES_FILE, messages.slice(0, 500));
}

/* ------------------------------------------------------------------ */
/* Accounts                                                            */
/* ------------------------------------------------------------------ */

const ACCOUNTS_BLOB = "data/accounts.json";
const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

export async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(salt + ":" + password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("folje-pw-v1"));
  return Buffer.from(sig).toString("hex");
}

export async function makeAccount(username: string, password: string, role: Role, createdBy: string): Promise<Account> {
  const salt = crypto.randomUUID();
  return {
    id: crypto.randomUUID(),
    username: username.toLowerCase(),
    salt,
    passHash: await hashPassword(password, salt),
    role,
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

/** Accounts are auto-seeded with one Owner on first use. */
export async function readAccounts(): Promise<Account[]> {
  const data = await readJSON<unknown>(ACCOUNTS_BLOB, ACCOUNTS_FILE, null);
  if (Array.isArray(data) && data.length > 0) return data as Account[];
  const owner = await makeAccount("lorik", "lorikfx", "owner", "system");
  await writeJSON(ACCOUNTS_BLOB, ACCOUNTS_FILE, [owner]);
  return [owner];
}

export async function writeAccounts(accounts: Account[]) {
  await writeJSON(ACCOUNTS_BLOB, ACCOUNTS_FILE, accounts);
}

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

const LOGS_BLOB = "data/logs.json";
const LOGS_FILE = path.join(DATA_DIR, "logs.json");

export async function readLogs(): Promise<LogEntry[]> {
  const data = await readJSON<unknown>(LOGS_BLOB, LOGS_FILE, []);
  return Array.isArray(data) ? (data as LogEntry[]) : [];
}

export async function writeLogs(logs: LogEntry[]) {
  await writeJSON(LOGS_BLOB, LOGS_FILE, logs.slice(0, 1000));
}

/* ------------------------------------------------------------------ */
/* Stats & secret                                                      */
/* ------------------------------------------------------------------ */

const STATS_BLOB = "data/stats.json";
const STATS_FILE = path.join(DATA_DIR, "stats.json");

const defaultStats: Stats = { visits: 0, messagesSent: 0, lastVisitAt: "" };

export async function readStats(): Promise<Stats> {
  const data = await readJSON<Partial<Stats>>(STATS_BLOB, STATS_FILE, defaultStats);
  return { ...defaultStats, ...data };
}

export async function writeStats(stats: Stats) {
  await writeJSON(STATS_BLOB, STATS_FILE, stats);
}

const SECRET_BLOB = "data/secret.txt";
const SECRET_FILE = path.join(DATA_DIR, "secret.txt");

/** Server-side signing secret, generated once and stored privately. */
export async function readSecret(): Promise<string> {
  const existing = await readText(SECRET_BLOB, SECRET_FILE);
  if (existing && existing.trim().length >= 32) return existing.trim();
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Buffer.from(bytes).toString("hex");
  await writeText(SECRET_BLOB, SECRET_FILE, secret);
  return secret;
}

/** Owner-only: wipe content, messages, logs and stats (accounts kept). */
export async function resetSiteData() {
  await writeDesigns([]);
  await writeMessages([]);
  await writeLogs([]);
  await writeStats(defaultStats);
  await writeSettings(defaultSettings);
}
