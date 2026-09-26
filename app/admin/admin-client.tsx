"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Design, SiteSettings, Message } from "@/lib/store";

const LOGO = "/logo.png";
const CATEGORIES = ["Makina", "Motoçikleta", "Të dyja"] as const;
type Tab = "overview" | "designs" | "messages" | "settings";

type AdminStats = {
  visits: number;
  designsTotal: number;
  designsVisible: number;
  messagesTotal: number;
  messagesUnread: number;
  lastVisitAt: string;
};

const emptyForm = {
  title: "",
  price: "",
  description: "",
  category: "Të dyja" as string,
  badge: "",
  featured: false,
  visible: true,
  image: null as File | null,
};

/* ------------------------------------------------------------------ */

export default function AdminClient() {
  const [logged, setLogged] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [items, setItems] = useState<Design[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Design | null>(null);
  const [editForm, setEditForm] = useState({ title: "", price: "", description: "", category: "", badge: "", image: null as File | null });

  const flash = (kind: "ok" | "err", text: string) => {
    setMessage({ kind, text });
    window.setTimeout(() => setMessage(null), 4000);
  };

  const loadDesigns = useCallback(async () => {
    const r = await fetch("/api/admin/designs", { cache: "no-store" });
    if (r.status === 401) { setLogged(false); return; }
    if (r.ok) setItems(await r.json());
  }, []);
  const loadMessages = useCallback(async () => {
    const r = await fetch("/api/admin/messages", { cache: "no-store" });
    if (r.ok) setMessages(await r.json());
  }, []);
  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/admin/settings", { cache: "no-store" });
    if (r.ok) setSettings(await r.json());
  }, []);
  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { cache: "no-store" });
    if (r.ok) setStats(await r.json());
  }, []);
  const loadAll = useCallback(async () => {
    await Promise.all([loadDesigns(), loadMessages(), loadSettings(), loadStats()]);
  }, [loadDesigns, loadMessages, loadSettings, loadStats]);

  /* Restore session on reload: try a protected fetch once. */
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/stats", { cache: "no-store" }).catch(() => null);
      if (r && r.ok) {
        setLogged(true);
        await loadAll();
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings) document.documentElement.style.setProperty("--accent", settings.accent || "#5bc7ff");
  }, [settings]);

  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (r.ok) {
      setLogged(true);
      setPassword("");
      flash("ok", "Mirë se erdhe! U kyçe me sukses.");
      await loadAll();
    } else {
      flash("err", data.error || "Fjalëkalimi nuk është i saktë.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setLogged(false);
    setItems([]);
    setMessages([]);
    setStats(null);
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData();
    fd.append("title", form.title);
    fd.append("price", form.price);
    fd.append("description", form.description);
    fd.append("category", form.category);
    fd.append("badge", form.badge);
    fd.append("featured", String(form.featured));
    fd.append("visible", String(form.visible));
    if (form.image) fd.append("image", form.image);
    const r = await fetch("/api/admin/designs", { method: "POST", body: fd });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) {
      flash("err", data.error || "Gabim gjatë ruajtjes.");
      return;
    }
    flash("ok", "Dizajni u publikua ✓");
    setForm(emptyForm);
    const fileInput = document.getElementById("design-image-input") as HTMLInputElement | null;
    if (fileInput) fileInput.value = "";
    await Promise.all([loadDesigns(), loadStats()]);
  }

  async function patch(payload: Record<string, unknown> | FormData, okText: string) {
    const isFd = payload instanceof FormData;
    const r = await fetch("/api/admin/designs", {
      method: "PATCH",
      ...(isFd ? { body: payload } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    });
    if (r.ok) {
      if (okText) flash("ok", okText);
      await Promise.all([loadDesigns(), loadStats()]);
      return true;
    }
    const data = await r.json().catch(() => ({}));
    flash("err", data.error || "Nuk u ruajt.");
    return false;
  }

  async function remove(d: Design) {
    if (!confirm(`A dëshiron ta fshish “${d.title}”? Kjo nuk kthehet mbrapsht.`)) return;
    const r = await fetch("/api/admin/designs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id }),
    });
    if (r.ok) {
      flash("ok", "Dizajni u fshi.");
      await Promise.all([loadDesigns(), loadStats()]);
    } else flash("err", "Nuk u fshi.");
  }

  async function move(d: Design, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((x) => x.id === d.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    const oa = a.order, ob = b.order;
    a.order = ob === oa ? ob + dir : ob;
    b.order = oa;
    setItems([...items]);
    await patch({ id: a.id, order: a.order }, "");
    await patch({ id: b.id, order: b.order }, "Renditja u përditësua.");
  }

  function startEdit(d: Design) {
    setEditing(d);
    setEditForm({ title: d.title, price: d.price, description: d.description, category: d.category, badge: d.badge, image: null });
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setLoading(true);
    const fd = new FormData();
    fd.append("id", editing.id);
    fd.append("title", editForm.title);
    fd.append("price", editForm.price);
    fd.append("description", editForm.description);
    fd.append("category", editForm.category);
    fd.append("badge", editForm.badge);
    if (editForm.image) fd.append("image", editForm.image);
    const ok = await patch(fd, "Dizajni u përditësua ✓");
    setLoading(false);
    if (ok) setEditing(null);
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setLoading(true);
    const r = await fetch("/api/admin/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setLoading(false);
    if (r.ok) {
      setSettings(await r.json());
      flash("ok", "Cilësimet u ruajtën ✓ Website-i u përditësua.");
    } else flash("err", "Cilësimet nuk u ruajtën.");
  }

  async function readMessage(m: Message, read: boolean) {
    await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, read }),
    });
    await Promise.all([loadMessages(), loadStats()]);
  }

  async function deleteMessage(m: Message) {
    if (!confirm("Të fshihet mesazhi?")) return;
    await fetch("/api/admin/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    await Promise.all([loadMessages(), loadStats()]);
  }

  /* ------------------------------------------------------- LOGIN VIEW */
  if (checking) {
    return (
      <main className="admin-shell">
        <div className="admin-login">
          <div className="admin-login-loader">Duke kontrolluar sesionin…</div>
        </div>
      </main>
    );
  }

  if (!logged) {
    return (
      <main className="admin-shell">
        <div className="admin-login">
          <div className="admin-login-bg" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="FOLJE EXPRESS" />
          <span className="eyebrow">PRIVATE ADMIN · I MBROJTUR</span>
          <h1>Paneli yt.</h1>
          <p>Menaxho dizajnet, çmimet, fotot, mesazhet dhe cilësimet e website-it. Hyrja mbrohet me fjalëkalim + kufizim përpjekjesh (anti brute-force).</p>
          <form onSubmit={login}>
            <input
              type="password"
              placeholder="Fjalëkalimi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              maxLength={200}
            />
            <button className="btn primary big" disabled={loading}>
              {loading ? "Duke hyrë…" : "Hyr në panel →"}
            </button>
          </form>
          {message && <small className={message.kind === "err" ? "form-error" : ""}>{message.text}</small>}
          <a className="back-link" href="/">← Kthehu në website</a>
        </div>
      </main>
    );
  }

  /* ---------------------------------------------------- DASHBOARD VIEW */
  const realItems = [...items].filter((x) => !x.id.startsWith("demo-")).sort((a, b) => a.order - b.order);
  const unread = messages.filter((m) => !m.read).length;

  return (
    <main className="admin-shell">
      <header className="admin-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="FOLJE EXPRESS" />
        <div className="admin-top-title">
          <b>ADMIN</b>
          <span>Paneli i menaxhimit</span>
        </div>
        <div className="admin-top-actions">
          <a className="btn small" href="/" target="_blank" rel="noopener noreferrer">Website ↗</a>
          <button className="btn small danger" onClick={logout}>Dil</button>
        </div>
      </header>

      <nav className="admin-tabs" role="tablist">
        <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}>📊 Përmbledhje</button>
        <button className={tab === "designs" ? "active" : ""} onClick={() => setTab("designs")}>
          🎨 Dizajnet {realItems.length > 0 && <em>{realItems.length}</em>}
        </button>
        <button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}>
          ✉️ Mesazhet {unread > 0 && <em className="hot">{unread}</em>}
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>⚙️ Cilësimet</button>
      </nav>

      {message && <div className={"admin-message " + message.kind}>{message.text}</div>}

      {/* ---------------------------------------------------- OVERVIEW */}
      {tab === "overview" && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">DASHBOARD</span>
              <h1>Përmbledhja.</h1>
            </div>
            <button className="btn small" onClick={loadAll}>↻ Rifresko</button>
          </div>
          <div className="stat-grid">
            <div className="stat-card"><span>VIZITA</span><strong>{stats?.visits ?? "—"}</strong><small>nga vizitorë unikë</small></div>
            <div className="stat-card"><span>DIZAJNE PUBLIKE</span><strong>{stats?.designsVisible ?? "—"}</strong><small>nga {stats?.designsTotal ?? 0} gjithsej</small></div>
            <div className="stat-card"><span>MESAZHE</span><strong>{stats?.messagesTotal ?? "—"}</strong><small>{stats?.messagesUnread ?? 0} të palexuara</small></div>
            <div className="stat-card"><span>FUNDIT VIZITË</span><strong className="tiny">{stats?.lastVisitAt ? new Date(stats.lastVisitAt).toLocaleString("sq") : "—"}</strong><small>të gjitha kohërat</small></div>
          </div>
          <div className="quick-card">
            <h2>Çfarë mund të bësh këtu</h2>
            <ul>
              <li><b>+</b> Shto dizajne të reja me foto, çmim, përshkrim e kategori</li>
              <li><b>€</b> Ndrysho çmimin e çdo dizajni në moment (tab Dizajnet → Ndrysho)</li>
              <li><b>🖼</b> Zëvendëso foton e një dizajni ekzistues</li>
              <li><b>★</b> Shëno dizajne si “të zgjedhura” ose fshihi përkohësisht</li>
              <li><b>↕</b> Rendit dizajnet me shigjeta lart/poshtë</li>
              <li><b>✉️</b> Lexo kërkesat e klientëve nga forma e kontaktit</li>
              <li><b>⚙️</b> Ndrysho telefonin, WhatsApp, Instagram, tekstet e hero-it dhe ngjyrën e theksit</li>
            </ul>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- DESIGNS */}
      {tab === "designs" && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">CONTENT MANAGEMENT</span>
              <h1>Dizajnet.</h1>
            </div>
            <span>{realItems.length} dizajne reale</span>
          </div>

          <form className="upload-card" onSubmit={create}>
            <div className="upload-copy">
              <span className="eyebrow">NEW DESIGN</span>
              <h2>Publiko një dizajn.</h2>
              <p>Ngarko foton (opsionale), vendos çmimin dhe kategorinë. Dizajni del menjëherë në website.</p>
            </div>
            <div className="form-grid">
              <input required placeholder="Titulli *" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input placeholder="Çmimi, p.sh. 120€ ose 'Na kontakto'" value={form.price} maxLength={60} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Etiketa, p.sh. E RE / POPULLOR (opsionale)" value={form.badge} maxLength={24} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
              <label className="file-drop">
                <input id="design-image-input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
                <span>{form.image ? `📎 ${form.image.name}` : "🖼 Zgjidh foto (opsionale, max 12MB)"}</span>
              </label>
              <textarea placeholder="Përshkrimi" value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> ★ Dizajn i zgjedhur</label>
              <label className="check"><input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} /> Publik në website</label>
              <button className="btn primary big" disabled={loading}>{loading ? "Duke ruajtur…" : "+ Publiko dizajnin"}</button>
            </div>
          </form>

          <div className="admin-list">
            {realItems.map((d) => (
              <article key={d.id} className={"admin-item " + (d.visible ? "" : "hidden-item")}>
                {d.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.image} alt="" />
                ) : (
                  <div className="admin-thumb-empty">3D</div>
                )}
                <div className="admin-item-body">
                  <span className="admin-item-meta">
                    {d.category} · <b className={d.visible ? "ok" : "warn"}>{d.visible ? "PUBLIK" : "I FSHEHUR"}</b>
                    {d.featured && <> · <b className="star">★ E ZGJEDHUR</b></>}
                    {d.badge && <> · {d.badge}</>}
                  </span>
                  <h3>{d.title}</h3>
                  <p>{d.price}{d.description ? ` · ${d.description}` : ""}</p>
                </div>
                <div className="admin-actions">
                  <div className="order-btns">
                    <button title="Ngjite lart" onClick={() => move(d, -1)}>↑</button>
                    <button title="Zbrite poshtë" onClick={() => move(d, 1)}>↓</button>
                  </div>
                  <button onClick={async () => { await patch({ id: d.id, featured: !d.featured }, d.featured ? "U hoq nga të zgjedhurat." : "★ U shënua si i zgjedhur!"); }}>
                    {d.featured ? "★ Hiq" : "★ Zgjidh"}
                  </button>
                  <button onClick={() => patch({ id: d.id, visible: !d.visible }, d.visible ? "Dizajni u fsheh." : "Dizajni u publikua.")}>
                    {d.visible ? "Fshih" : "Publiko"}
                  </button>
                  <button onClick={() => startEdit(d)}>✎ Ndrysho</button>
                  <button className="danger" onClick={() => remove(d)}>🗑 Fshi</button>
                </div>
              </article>
            ))}
            {items.filter((x) => x.id.startsWith("demo-")).length > 0 && realItems.length === 0 && (
              <div className="empty admin-empty">
                Ende nuk ke publikuar dizajne reale — po shfaqen 3 shembuj demonstrues. Publiko dizajnin tënd të parë më sipër; shembujt hiqen automatikisht.
              </div>
            )}
            {items.length === 0 && <div className="empty admin-empty">Ende nuk ke dizajne.</div>}
          </div>

          {editing && (
            <div className="modal-backdrop" onClick={() => setEditing(null)}>
              <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
                <span className="eyebrow">EDIT DESIGN</span>
                <h2>Ndrysho “{editing.title}”</h2>
                <div className="modal-preview">
                  {editing.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editing.image} alt="" />
                  ) : (
                    <div className="admin-thumb-empty big">3D</div>
                  )}
                </div>
                <label>Titulli</label>
                <input required value={editForm.title} maxLength={80} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                <label>Çmimi</label>
                <input value={editForm.price} maxLength={60} placeholder="p.sh. 150€" onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                <label>Kategoria</label>
                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <label>Etiketa (badge)</label>
                <input value={editForm.badge} maxLength={24} placeholder="p.sh. E RE" onChange={(e) => setEditForm({ ...editForm, badge: e.target.value })} />
                <label>Përshkrimi</label>
                <textarea value={editForm.description} maxLength={500} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                <label>Zëvendëso foton</label>
                <label className="file-drop">
                  <input type="file" accept="image/*" onChange={(e) => setEditForm({ ...editForm, image: e.target.files?.[0] || null })} />
                  <span>{editForm.image ? `📎 ${editForm.image.name}` : "🖼 Foto e re (opsionale)"}</span>
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setEditing(null)}>Anulo</button>
                  <button className="btn primary" disabled={loading}>{loading ? "Duke ruajtur…" : "Ruaj ndryshimet ✓"}</button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {/* ---------------------------------------------------- MESSAGES */}
      {tab === "messages" && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">INBOX</span>
              <h1>Mesazhet.</h1>
            </div>
            <span>{unread} të palexuara nga {messages.length}</span>
          </div>
          <div className="msg-list">
            {messages.map((m) => (
              <article key={m.id} className={"msg-item " + (m.read ? "" : "unread")}>
                <div className="msg-head">
                  <b>{m.name}</b>
                  {m.vehicle && <span className="chip">{m.vehicle}</span>}
                  {m.service && <span className="chip">{m.service}</span>}
                  <time>{new Date(m.createdAt).toLocaleString("sq")}</time>
                </div>
                <div className="msg-contact">
                  {m.phone && <a href={`tel:${m.phone}`}>📞 {m.phone}</a>}
                  {m.email && <a href={`mailto:${m.email}`}>✉️ {m.email}</a>}
                </div>
                {m.message && <p className="msg-text">{m.message}</p>}
                <div className="msg-actions">
                  <button onClick={() => readMessage(m, !m.read)}>{m.read ? "Shëno si të palexuar" : "✓ Shëno si të lexuar"}</button>
                  {m.phone && <a className="btn small" href={`https://wa.me/${m.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                  <button className="danger" onClick={() => deleteMessage(m)}>Fshi</button>
                </div>
              </article>
            ))}
            {messages.length === 0 && (
              <div className="empty admin-empty">
                Nuk ka mesazhe ende. Kur dikush plotëson formën e kontaktit në website, kërkesa shfaqet këtu.
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- SETTINGS */}
      {tab === "settings" && settings && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">SITE SETTINGS</span>
              <h1>Cilësimet.</h1>
            </div>
          </div>
          <form className="settings-card" onSubmit={saveSettings}>
            <div className="settings-group">
              <h3>Biznesi & kontakti</h3>
              <div className="settings-grid">
                <label>Emri i biznesit<input value={settings.businessName} onChange={(e) => setSettings({ ...settings, businessName: e.target.value })} /></label>
                <label>Tagline<input value={settings.tagline} onChange={(e) => setSettings({ ...settings, tagline: e.target.value })} /></label>
                <label>Telefoni<input value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} /></label>
                <label>WhatsApp (numër me kod shteti)<input value={settings.whatsapp} onChange={(e) => setSettings({ ...settings, whatsapp: e.target.value })} /></label>
                <label>Instagram<input value={settings.instagram} onChange={(e) => setSettings({ ...settings, instagram: e.target.value })} /></label>
                <label>TikTok<input value={settings.tiktok} onChange={(e) => setSettings({ ...settings, tiktok: e.target.value })} /></label>
                <label>Email<input value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} /></label>
                <label>Adresa<input value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} /></label>
                <label>Orari<input value={settings.hours} onChange={(e) => setSettings({ ...settings, hours: e.target.value })} /></label>
              </div>
            </div>
            <div className="settings-group">
              <h3>Hero (ballina) & pamja</h3>
              <div className="settings-grid">
                <label className="wide">Teksti i vogël (eyebrow)<input value={settings.heroEyebrow} onChange={(e) => setSettings({ ...settings, heroEyebrow: e.target.value })} /></label>
                <label>Titulli (rreshti 1)<input value={settings.heroTitle} onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })} /></label>
                <label>Titulli i theksuar (rreshti 2)<input value={settings.heroHighlight} onChange={(e) => setSettings({ ...settings, heroHighlight: e.target.value })} /></label>
                <label className="wide">Nëntitulli<textarea rows={3} value={settings.heroSubtitle} onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })} /></label>
                <label className="wide">Rreth nesh<textarea rows={3} value={settings.about} onChange={(e) => setSettings({ ...settings, about: e.target.value })} /></label>
                <label>Ngjyra e theksit
                  <span className="accent-row">
                    <input type="color" value={settings.accent} onChange={(e) => setSettings({ ...settings, accent: e.target.value })} />
                    <code>{settings.accent}</code>
                  </span>
                </label>
              </div>
            </div>
            <div className="settings-actions">
              <button className="btn primary big" disabled={loading}>{loading ? "Duke ruajtur…" : "Ruaj cilësimet ✓"}</button>
              <a className="btn" href="/" target="_blank" rel="noopener noreferrer">Shiko website-in ↗</a>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
