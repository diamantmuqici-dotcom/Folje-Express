import { promises as fs } from "fs";
import path from "path";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type Category = "Makina" | "Motoçikleta" | "Të dyja";
export const CATEGORIES: Category[] = ["Makina", "Motoçikleta", "Të dyja"];

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
  accent: string;
  about: string;
};

export type Message = {
  id: string;
  name: string;
  phone: string;
  email: string;
  vehicle: string;
  service: string;
  designId: string;
  message: string;
  createdAt: string;
  read: boolean;
};

export type Stats = {
  visits: number;
  messagesSent: number;
  lastVisitAt: string;
};

/* ------------------------------------------------------------------ */
/* Storage backend: Vercel Blob when configured, local files in dev.   */
/* ------------------------------------------------------------------ */

const DATA_DIR = path.join(process.cwd(), "data");
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

function hasBlob() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

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

/** Save an uploaded image; returns its public URL. */
export async function saveImage(file: File): Promise<string> {
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

/** Delete an image previously returned by saveImage(). Safe to call blindly. */
export async function removeImage(url: string) {
  if (!url) return;
  try {
    if (url.startsWith("/uploads/")) {
      const name = path.basename(url); // prevent traversal
      await fs.unlink(path.join(UPLOAD_DIR, name)).catch(() => {});
      return;
    }
    if (hasBlob() && url.startsWith("http")) {
      const { del } = await import("@vercel/blob");
      await del(url);
    }
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Designs                                                             */
/* ------------------------------------------------------------------ */

const DESIGNS_BLOB = "data/designs.json";
const DESIGNS_FILE = path.join(DATA_DIR, "designs.json");

const demoDesigns: Design[] = [
  {
    id: "demo-1",
    title: "Gloss Midnight Black",
    price: "Na kontakto",
    description: "Folie gloss e zezë e thellë — pamje sportive dhe elegante për çdo makinë.",
    category: "Makina",
    image: "",
    badge: "POPULLOR",
    featured: true,
    visible: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    order: 1,
  },
  {
    id: "demo-2",
    title: "Satin Race Red",
    price: "Na kontakto",
    description: "E kuqe satine me shkëlqim të butë — për makina dhe motoçikleta që duan vëmendje.",
    category: "Të dyja",
    image: "",
    badge: "E RE",
    featured: true,
    visible: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    order: 2,
  },
  {
    id: "demo-3",
    title: "Chrome Electric Blue",
    price: "Na kontakto",
    description: "Efekt kromi me ton elektrik — përfundim premium me reflektim të lartë.",
    category: "Motoçikleta",
    image: "",
    badge: "",
    featured: false,
    visible: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
    order: 3,
  },
];

/** Fill in any fields missing from older stored records (schema migration). */
function normalizeDesign(raw: Partial<Design>, index: number): Design {
  return {
    id: String(raw.id || crypto.randomUUID()),
    title: String(raw.title || "Pa titull"),
    price: String(raw.price || "Na kontakto"),
    description: String(raw.description || ""),
    category: CATEGORIES.includes(raw.category as Category) ? (raw.category as Category) : "Të dyja",
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
  if (!Array.isArray(data) || data.length === 0) return demoDesigns;
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
  tagline: "Automotive Wrap Studio",
  phone: "+383 49 000 000",
  whatsapp: "+38349000000",
  instagram: "foljeexpress",
  tiktok: "foljeexpress",
  email: "info@foljeexpress.com",
  address: "Prishtinë, Kosovë",
  hours: "E Hënë – E Shtunë · 09:00 – 19:00",
  heroEyebrow: "FOLJE EXPRESS / AUTOMOTIVE WRAP STUDIO",
  heroTitle: "Ndrysho",
  heroHighlight: "pamjen.",
  heroSubtitle:
    "Folie premium me ngjyra dhe dizajne për makina dhe motoçikleta. Një pamje e re, e ndërtuar rreth stilit tënd — nga folje express, për folje express rezultat.",
  accent: "#5bc7ff",
  about:
    "Folje Express është studio e specializuar për folie (wrap) automobilistike: ndërrim ngjyre, mbrojtje paint protection, dizajne custom dhe detaje për makina e motoçikleta. Çdo punë bëhet me materiale premium dhe përfundim të pastër.",
};

export async function readSettings(): Promise<SiteSettings> {
  const data = await readJSON<Partial<SiteSettings>>(SETTINGS_BLOB, SETTINGS_FILE, {});
  return { ...defaultSettings, ...data };
}

export async function writeSettings(settings: SiteSettings) {
  await writeJSON(SETTINGS_BLOB, SETTINGS_FILE, settings);
}

/* ------------------------------------------------------------------ */
/* Messages (contact / order requests)                                 */
/* ------------------------------------------------------------------ */

const MESSAGES_BLOB = "data/messages.json";
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");

export async function readMessages(): Promise<Message[]> {
  const data = await readJSON<unknown>(MESSAGES_BLOB, MESSAGES_FILE, []);
  return Array.isArray(data) ? (data as Message[]) : [];
}

export async function writeMessages(messages: Message[]) {
  await writeJSON(MESSAGES_BLOB, MESSAGES_FILE, messages.slice(0, 500)); // keep last 500
}

/* ------------------------------------------------------------------ */
/* Stats                                                               */
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
