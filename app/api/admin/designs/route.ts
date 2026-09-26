import { isAdmin } from "@/lib/auth";
import { readDesigns, writeDesigns, removeImage, saveImage, CATEGORIES, type Design } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: FormDataEntryValue | null, max = 1000) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function unauthorized() {
  return Response.json({ error: "Nuk je i autorizuar." }, { status: 401 });
}

/** All designs (including hidden) for the admin panel. */
export async function GET() {
  if (!(await isAdmin())) return unauthorized();
  const designs = await readDesigns();
  return Response.json(designs, { headers: { "Cache-Control": "no-store" } });
}

/** Create a design. Image optional — demo swatch is used when missing. */
export async function POST(request: Request) {
  if (!(await isAdmin())) return unauthorized();

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });

  const file = form.get("image");
  let image = "";
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: "Skedari duhet të jetë foto." }, { status: 400 });
    }
    if (file.size > 12 * 1024 * 1024) {
      return Response.json({ error: "Fotoja duhet të jetë nën 12MB." }, { status: 400 });
    }
    image = await saveImage(file);
  }

  const rawCategory = clean(form.get("category"), 30);
  const now = new Date().toISOString();
  // First real design replaces the demo showcase entries.
  const data = (await readDesigns()).filter((d) => !d.id.startsWith("demo-"));
  const design: Design = {
    id: crypto.randomUUID(),
    title: clean(form.get("title"), 80) || "Pa titull",
    price: clean(form.get("price"), 60) || "Na kontakto",
    description: clean(form.get("description"), 500),
    category: (CATEGORIES as string[]).includes(rawCategory) ? (rawCategory as Design["category"]) : "Të dyja",
    image,
    badge: clean(form.get("badge"), 24),
    featured: form.get("featured") === "true",
    visible: form.get("visible") !== "false",
    createdAt: now,
    updatedAt: now,
    order: data.length ? Math.min(...data.map((d) => d.order)) - 1 : 0,
  };

  data.unshift(design);
  await writeDesigns(data);
  return Response.json(design);
}

/**
 * Update a design: title, price, description, category, badge, featured,
 * visible, order — and optionally replace the image (send multipart form or
 * JSON; JSON only updates text fields).
 */
export async function PATCH(request: Request) {
  if (!(await isAdmin())) return unauthorized();

  const contentType = request.headers.get("content-type") || "";
  let fields: Record<string, unknown> = {};
  let newImageFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    if (!form) return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });
    for (const [k, v] of form.entries()) fields[k] = v;
    const file = form.get("image");
    if (file instanceof File && file.size > 0) newImageFile = file;
  } else {
    fields = await request.json().catch(() => ({}));
  }

  const id = String(fields.id || "");
  const data = await readDesigns();
  const item = data.find((d) => d.id === id);
  if (!item) return Response.json({ error: "Dizajni nuk u gjet." }, { status: 404 });

  if (typeof fields.title === "string") item.title = fields.title.trim().slice(0, 80) || item.title;
  if (typeof fields.price === "string") item.price = fields.price.trim().slice(0, 60) || item.price;
  if (typeof fields.description === "string") item.description = fields.description.trim().slice(0, 500);
  if (typeof fields.badge === "string") item.badge = fields.badge.trim().slice(0, 24);
  if ((CATEGORIES as string[]).includes(String(fields.category))) {
    item.category = fields.category as Design["category"];
  }
  if (typeof fields.featured === "boolean") item.featured = fields.featured;
  if (typeof fields.featured === "string") item.featured = fields.featured === "true";
  if (typeof fields.visible === "boolean") item.visible = fields.visible;
  if (typeof fields.visible === "string") item.visible = fields.visible === "true";
  if (typeof fields.order === "number" && Number.isFinite(fields.order)) item.order = fields.order;

  if (newImageFile) {
    if (!newImageFile.type.startsWith("image/")) {
      return Response.json({ error: "Skedari duhet të jetë foto." }, { status: 400 });
    }
    if (newImageFile.size > 12 * 1024 * 1024) {
      return Response.json({ error: "Fotoja duhet të jetë nën 12MB." }, { status: 400 });
    }
    const url = await saveImage(newImageFile);
    await removeImage(item.image);
    item.image = url;
  }

  item.updatedAt = new Date().toISOString();
  await writeDesigns(data);
  return Response.json(item);
}

/** Delete a design (and its stored image). */
export async function DELETE(request: Request) {
  if (!(await isAdmin())) return unauthorized();
  const { id } = await request.json().catch(() => ({}));
  const data = await readDesigns();
  const item = data.find((d) => d.id === id);
  if (!item) return Response.json({ error: "Dizajni nuk u gjet." }, { status: 404 });
  await removeImage(item.image);
  await writeDesigns(data.filter((d) => d.id !== id));
  return Response.json({ ok: true });
}
