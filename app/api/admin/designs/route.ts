import { guard } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { clientIp } from "@/lib/ratelimit";
import { readDesigns, writeDesigns, removeImage, saveImage, CATEGORIES, type Design } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: FormDataEntryValue | null, max = 1000) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** All designs (including hidden) for the admin panel. Admin+ only. */
export async function GET() {
  const g = await guard("designs.view");
  if (!g.ok) return g.response;
  const designs = await readDesigns();
  return Response.json(designs, { headers: { "Cache-Control": "no-store" } });
}

/** Create a design. Admin+ only. */
export async function POST(request: Request) {
  const g = await guard("designs.create");
  if (!g.ok) return g.response;
  const ip = clientIp(request);

  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Kërkesë e pavlefshme." }, { status: 400 });

  const file = form.get("image");
  let image = "";
  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith("image/")) return Response.json({ error: "Skedari duhet të jetë foto." }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return Response.json({ error: "Fotoja duhet të jetë nën 12MB." }, { status: 400 });
    image = await saveImage(file);
  }

  const rawCategory = clean(form.get("category"), 30);
  const now = new Date().toISOString();
  const data = await readDesigns();
  const title = clean(form.get("title"), 80) || "Pa titull";
  const design: Design = {
    id: crypto.randomUUID(),
    title,
    price: clean(form.get("price"), 60) || "Na kontakto",
    description: clean(form.get("description"), 500),
    category: (CATEGORIES as string[]).includes(rawCategory) ? (rawCategory as Design["category"]) : "Motoçikleta",
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
  await audit(g.session, "design.create", `+ "${design.title}" (${design.price})`, ip);
  return Response.json(design);
}

/** Update a design (price, texts, badge, featured, visible, order, image replace). */
export async function PATCH(request: Request) {
  const g = await guard("designs.update");
  if (!g.ok) return g.response;
  const ip = clientIp(request);

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

  const changes: string[] = [];
  if (typeof fields.title === "string" && fields.title.trim() && fields.title.trim() !== item.title) {
    changes.push(`titulli: "${item.title}" → "${fields.title.trim().slice(0, 80)}"`);
    item.title = fields.title.trim().slice(0, 80);
  }
  if (typeof fields.price === "string" && fields.price.trim() && fields.price.trim() !== item.price) {
    changes.push(`çmimi: ${item.price} → ${fields.price.trim().slice(0, 60)}`);
    item.price = fields.price.trim().slice(0, 60);
  }
  if (typeof fields.description === "string" && fields.description !== item.description) {
    changes.push("përshkrimi u ndryshua");
    item.description = fields.description.trim().slice(0, 500);
  }
  if (typeof fields.badge === "string" && fields.badge.trim() !== item.badge) {
    changes.push(`etiketa: "${item.badge}" → "${fields.badge.trim().slice(0, 24)}"`);
    item.badge = fields.badge.trim().slice(0, 24);
  }
  if ((CATEGORIES as string[]).includes(String(fields.category)) && fields.category !== item.category) {
    changes.push(`kategoria: ${item.category} → ${fields.category}`);
    item.category = fields.category as Design["category"];
  }
  const feat = typeof fields.featured === "boolean" ? fields.featured : fields.featured === "true";
  if (typeof fields.featured !== "undefined" && feat !== item.featured) {
    changes.push(feat ? "u shënua i zgjedhur" : "u hoq nga të zgjedhurit");
    item.featured = feat;
  }
  const vis = typeof fields.visible === "boolean" ? fields.visible : fields.visible === "true";
  if (typeof fields.visible !== "undefined" && vis !== item.visible) {
    changes.push(vis ? "u publikua" : "u fsheh");
    item.visible = vis;
  }
  if (typeof fields.order === "number" && Number.isFinite(fields.order) && fields.order !== item.order) {
    changes.push("renditja u ndryshua");
    item.order = fields.order;
  }

  if (newImageFile) {
    if (!newImageFile.type.startsWith("image/")) return Response.json({ error: "Skedari duhet të jetë foto." }, { status: 400 });
    if (newImageFile.size > 12 * 1024 * 1024) return Response.json({ error: "Fotoja duhet të jetë nën 12MB." }, { status: 400 });
    const url = await saveImage(newImageFile);
    await removeImage(item.image);
    item.image = url;
    changes.push("fotoja u zëvendësua");
  }

  if (changes.length === 0) return Response.json(item);

  item.updatedAt = new Date().toISOString();
  await writeDesigns(data);
  await audit(g.session, "design.update", `"${item.title}": ${changes.join(", ")}`, ip);
  return Response.json(item);
}

/** Delete a design. Admin & Owner only (Co Owner updates/replaces but never deletes). */
export async function DELETE(request: Request) {
  const g = await guard("designs.delete");
  if (!g.ok) return g.response;
  const { id } = await request.json().catch(() => ({}));
  const data = await readDesigns();
  const item = data.find((d) => d.id === id);
  if (!item) return Response.json({ error: "Dizajni nuk u gjet." }, { status: 404 });
  await removeImage(item.image);
  await writeDesigns(data.filter((d) => d.id !== id));
  await audit(g.session, "design.delete", `- "${item.title}"`, clientIp(request));
  return Response.json({ ok: true });
}
