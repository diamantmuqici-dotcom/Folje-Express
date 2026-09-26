"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { Design, SiteSettings, Message, LogEntry } from "@/lib/store";
import type { Role } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/permissions";

const LOGO = "/logo.png";
const CATEGORIES = ["Motoçikleta", "Folje"] as const;
type Tab = "overview" | "orders" | "designs" | "settings" | "accounts" | "logs";

type AccountRow = { id: string; username: string; role: Role; createdAt: string; createdBy: string };
type AdminStats = {
  restricted?: boolean;
  visits?: number;
  designsTotal?: number;
  designsVisible?: number;
  messagesTotal?: number;
  messagesUnread?: number;
  ordersPending?: number;
  ordersAccepted?: number;
  lastVisitAt?: string;
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

export default function AdminClient() {
  /* ---------- session ---------- */
  const [me, setMe] = useState<{ username: string; role: Role } | null>(null);
  const [checking, setChecking] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /* ---------- ui ---------- */
  const [tab, setTab] = useState<Tab>("orders");
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  /* ---------- data ---------- */
  const [items, setItems] = useState<Design[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [creatable, setCreatable] = useState<Role[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  /* ---------- forms ---------- */
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Design | null>(null);
  const [editForm, setEditForm] = useState({ title: "", price: "", description: "", category: "", badge: "", image: null as File | null });
  const [accForm, setAccForm] = useState({ username: "", password: "", role: "staff" as Role });
  const [accEdit, setAccEdit] = useState<AccountRow | null>(null);
  const [accEditForm, setAccEditForm] = useState({ username: "", password: "", role: "staff" as Role });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: "", currentPassword: "", newPassword: "" });

  const say = (kind: "ok" | "err", text: string) => {
    setFlash({ kind, text });
    window.setTimeout(() => setFlash(null), 4500);
  };

  /* ---------- permission mirrors (server is the source of truth) ---------- */
  const role = me?.role;
  const canDesigns = role === "admin" || role === "coowner" || role === "owner";
  const canDelete = role === "admin" || role === "owner";
  const canAccounts = role === "coowner" || role === "owner";
  const canLogs = role === "coowner" || role === "owner";
  const canReset = role === "owner";

  /* ---------- loaders ---------- */
  const loadOrders = useCallback(async () => {
    const r = await fetch("/api/admin/messages", { cache: "no-store" });
    if (r.ok) setMessages(await r.json());
  }, []);
  const loadDesigns = useCallback(async () => {
    const r = await fetch("/api/admin/designs", { cache: "no-store" });
    if (r.ok) setItems(await r.json());
  }, []);
  const loadSettings = useCallback(async () => {
    const r = await fetch("/api/admin/settings", { cache: "no-store" });
    if (r.ok) setSettings(await r.json());
  }, []);
  const loadStats = useCallback(async () => {
    const r = await fetch("/api/admin/stats", { cache: "no-store" });
    if (r.ok) setStats(await r.json());
  }, []);
  const loadAccounts = useCallback(async () => {
    const r = await fetch("/api/admin/accounts", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setAccounts(d.accounts);
      setCreatable(d.creatable);
    }
  }, []);
  const loadLogs = useCallback(async () => {
    const r = await fetch("/api/admin/logs", { cache: "no-store" });
    if (r.ok) setLogs(await r.json());
  }, []);

  const loadAll = useCallback(async (r: Role) => {
    await loadOrders();
    const jobs: Promise<void>[] = [];
    if (r !== "staff") jobs.push(loadDesigns(), loadSettings(), loadStats());
    if (r === "coowner" || r === "owner") jobs.push(loadAccounts(), loadLogs());
    await Promise.all(jobs);
  }, [loadOrders, loadDesigns, loadSettings, loadStats, loadAccounts, loadLogs]);

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    (async () => {
      const r = await fetch("/api/admin/me", { cache: "no-store" }).catch(() => null);
      if (r && r.ok) {
        const s = await r.json();
        setMe(s);
        setTab(s.role === "staff" ? "orders" : "overview");
        await loadAll(s.role);
      }
      setChecking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (settings?.accent) document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings]);

  /* ---------- auth ---------- */
  async function login(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (r.ok) {
      setMe({ username: data.username, role: data.role });
      setTab(data.role === "staff" ? "orders" : "overview");
      setUsername("");
      setPassword("");
      say("ok", "Mirë se erdhe, " + data.username + ".");
      await loadAll(data.role);
    } else {
      say("err", data.error || "Kredencialet nuk janë të sakta.");
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setMe(null);
    setItems([]);
    setMessages([]);
    setStats(null);
    setAccounts([]);
    setLogs([]);
  }

  /* ---------- designs ---------- */
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
    if (!r.ok) return say("err", data.error || "Gabim gjatë ruajtjes.");
    say("ok", "Dizajni u publikua.");
    setForm(emptyForm);
    const fi = document.getElementById("design-image-input") as HTMLInputElement | null;
    if (fi) fi.value = "";
    await Promise.all([loadDesigns(), loadStats()]);
  }

  async function patchDesign(payload: Record<string, unknown> | FormData, okText: string) {
    const isFd = payload instanceof FormData;
    const r = await fetch("/api/admin/designs", {
      method: "PATCH",
      ...(isFd ? { body: payload } : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
    });
    if (r.ok) {
      if (okText) say("ok", okText);
      await Promise.all([loadDesigns(), loadStats()]);
      return true;
    }
    const data = await r.json().catch(() => ({}));
    say("err", data.error || "Nuk u ruajt.");
    return false;
  }

  async function removeDesign(d: Design) {
    if (!confirm(`A dëshiron ta fshish “${d.title}”? Kjo nuk kthehet mbrapsht.`)) return;
    const r = await fetch("/api/admin/designs", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: d.id }),
    });
    if (r.ok) {
      say("ok", "Dizajni u fshi.");
      await Promise.all([loadDesigns(), loadStats()]);
    } else say("err", "Nuk u fshi.");
  }

  async function move(d: Design, dir: -1 | 1) {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const i = sorted.findIndex((x) => x.id === d.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= sorted.length) return;
    const a = sorted[i], b = sorted[j];
    const oa = a.order;
    a.order = b.order === oa ? b.order + dir : b.order;
    b.order = oa;
    setItems([...items]);
    await patchDesign({ id: a.id, order: a.order }, "");
    await patchDesign({ id: b.id, order: b.order }, "Renditja u përditësua.");
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
    const ok = await patchDesign(fd, "Dizajni u përditësua.");
    setLoading(false);
    if (ok) setEditing(null);
  }

  /* ---------- orders ---------- */
  async function decide(m: Message, status: "accepted" | "declined" | "pending") {
    await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, status }),
    });
    await Promise.all([loadOrders(), loadStats()]);
  }
  async function readToggle(m: Message) {
    await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, read: !m.read }),
    });
    await loadOrders();
  }
  async function deleteMessage(m: Message) {
    if (!confirm("Të fshihet mesazhi?")) return;
    await fetch("/api/admin/messages", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    await Promise.all([loadOrders(), loadStats()]);
  }

  /* ---------- settings ---------- */
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
      say("ok", "Cilësimet u ruajtën. Website-i u përditësua.");
    } else say("err", "Cilësimet nuk u ruajtën.");
  }

  async function resetSite() {
    if (!confirm("Kjo fshin GJITHË dizajnet, mesazhet, statistikat dhe cilësimet. Vazhdo?")) return;
    if (!confirm("Je absolutisht i sigurt? Ky veprim nuk kthehet mbrapsht.")) return;
    const r = await fetch("/api/admin/reset", { method: "POST" });
    if (r.ok) {
      say("ok", "Përmbajtja u fshi.");
      await loadAll(me!.role);
    } else say("err", "Nuk u lejua.");
  }

  /* ---------- accounts ---------- */
  async function createAccount(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/admin/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(accForm),
    });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return say("err", data.error || "Nuk u krijua.");
    say("ok", `Llogaria ${data.username} u krijua me rol ${ROLE_LABELS[data.role as Role]}.`);
    setAccForm({ username: "", password: "", role: creatable[0] || "staff" });
    await loadAccounts();
  }

  async function saveAccEdit(e: FormEvent) {
    e.preventDefault();
    if (!accEdit) return;
    setLoading(true);
    const r = await fetch("/api/admin/accounts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accEdit.id, ...accEditForm, password: accEditForm.password || undefined }),
    });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return say("err", data.error || "Nuk u ruajt.");
    say("ok", "Llogaria u përditësua.");
    setAccEdit(null);
    await loadAccounts();
  }

  async function deleteAccount(a: AccountRow) {
    if (!confirm(`Të fshihet llogaria ${a.username}?`)) return;
    const r = await fetch("/api/admin/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id }),
    });
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      say("ok", "Llogaria u fshi.");
      await loadAccounts();
    } else say("err", data.error || "Nuk u fshi.");
  }

  /* ---------- profile ---------- */
  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const r = await fetch("/api/admin/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: profileForm.username || undefined,
        currentPassword: profileForm.currentPassword || undefined,
        password: profileForm.newPassword || undefined,
      }),
    });
    const data = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) return say("err", data.error || "Nuk u ruajt.");
    say("ok", "Profili u përditësua.");
    setMe({ username: data.username, role: data.role });
    setProfileOpen(false);
    setProfileForm({ username: "", currentPassword: "", newPassword: "" });
  }

  /* ================================================================ */
  /* LOGIN VIEW                                                        */
  /* ================================================================ */
  if (checking) {
    return (
      <main className="admin-shell">
        <div className="admin-login">
          <div className="admin-login-loader">Duke kontrolluar sesionin…</div>
        </div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="admin-shell">
        <div className="admin-login">
          <div className="admin-login-bg" aria-hidden="true" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt="FOLJE EXPRESS" />
          <span className="eyebrow">PRIVATE ADMIN · I MBROJTUR</span>
          <h1>Paneli i ekipit.</h1>
          <p>
            Hyrja me llogari dhe rol: Staff, Admin, Co Owner ose Owner. Çdo veprim regjistrohet
            në audit log dhe mbrohet me kufizim përpjekjesh anti brute-force.
          </p>
          <form onSubmit={login}>
            <input placeholder="Emri i përdoruesit" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" maxLength={40} />
            <input type="password" placeholder="Fjalëkalimi" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={200} />
            <button className="btn primary big" disabled={loading}>
              {loading ? "Duke hyrë…" : "Hyr në panel"}
            </button>
          </form>
          {flash && <small className={flash.kind === "err" ? "form-error" : ""}>{flash.text}</small>}
          <a className="back-link" href="/">Kthehu në website</a>
        </div>
      </main>
    );
  }

  /* ================================================================ */
  /* DASHBOARD                                                         */
  /* ================================================================ */
  const sortedItems = [...items].sort((a, b) => a.order - b.order);
  const unread = messages.filter((m) => !m.read).length;
  const pending = messages.filter((m) => m.status === "pending").length;

  const tabs: { id: Tab; label: string; show: boolean; count?: number }[] = [
    { id: "overview", label: "Përmbledhje", show: role !== "staff" },
    { id: "orders", label: "Porositë", show: true, count: pending },
    { id: "designs", label: "Dizajnet", show: canDesigns, count: items.length },
    { id: "settings", label: "Cilësimet", show: canDesigns },
    { id: "accounts", label: "Llogaritë", show: canAccounts, count: accounts.length },
    { id: "logs", label: "Audit Log", show: canLogs, count: logs.length },
  ];

  return (
    <main className="admin-shell">
      <header className="admin-top">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={LOGO} alt="FOLJE EXPRESS" />
        <div className="admin-top-title">
          <b>ADMIN</b>
          <span>
            {me.username} · <em className="role-chip">{ROLE_LABELS[me.role]}</em>
          </span>
        </div>
        <div className="admin-top-actions">
          <button className="btn small" onClick={() => setProfileOpen(true)}>Profili</button>
          <a className="btn small" href="/" target="_blank" rel="noopener noreferrer">Website</a>
          <button className="btn small danger" onClick={logout}>Dil</button>
        </div>
      </header>

      <nav className="admin-tabs" role="tablist">
        {tabs.filter((t) => t.show).map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
            {typeof t.count === "number" && t.count > 0 && <em className={t.id === "orders" ? "hot" : ""}>{t.count}</em>}
          </button>
        ))}
      </nav>

      {flash && <div className={"admin-message " + flash.kind}>{flash.text}</div>}

      {/* -------------------------------------------------- OVERVIEW */}
      {tab === "overview" && role !== "staff" && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">DASHBOARD</span>
              <h1>Përmbledhja.</h1>
            </div>
            <button className="btn small" onClick={() => loadAll(me.role)}>Rifresko</button>
          </div>
          {stats && !stats.restricted ? (
            <div className="stat-grid">
              <div className="stat-card"><span>VIZITA</span><strong>{stats.visits ?? 0}</strong><small>vizitorë unikë</small></div>
              <div className="stat-card"><span>POROSI PA PËRGJIGJE</span><strong>{stats.ordersPending ?? 0}</strong><small>{stats.ordersAccepted ?? 0} të pranuara</small></div>
              <div className="stat-card"><span>DIZAJNE PUBLIKE</span><strong>{stats.designsVisible ?? 0}</strong><small>nga {stats.designsTotal ?? 0} gjithsej</small></div>
              <div className="stat-card"><span>MESAZHE</span><strong>{stats.messagesTotal ?? 0}</strong><small>{stats.messagesUnread ?? 0} të palexuara</small></div>
            </div>
          ) : null}
          <div className="quick-card">
            <h2>Çfarë mund të bësh me rolin {ROLE_LABELS[me.role]}</h2>
            <ul>
              <li><b>1</b> Pranono ose refuzo porositë e klientëve te tabi Porositë</li>
              {canDesigns && <li><b>2</b> Shto dizajne, ndrysho çmime, zëvendëso foto, rendit dhe fsheh</li>}
              {canDesigns && <li><b>3</b> Ndrysho tekstet e website-it, kontaktet dhe ngjyrën e theksit</li>}
              {canAccounts && <li><b>4</b> Krijo dhe menaxho llogari Staff / Admin{me.role === "owner" ? " / Co Owner / Owner" : ""}</li>}
              {canLogs && <li><b>5</b> Shiko audit log-un: kush hyri, çfarë shtoi, ndryshoi ose fshiu</li>}
              {canReset && <li><b>6</b> Fshi gjithë përmbajtjen e website-it (vetëm Owner)</li>}
            </ul>
          </div>
        </section>
      )}

      {/* ---------------------------------------------------- ORDERS */}
      {tab === "orders" && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">INBOX</span>
              <h1>Porositë.</h1>
            </div>
            <span>{pending} në pritje · {unread} të palexuara</span>
          </div>
          <div className="msg-list">
            {messages.map((m) => (
              <article key={m.id} className={"msg-item " + (m.read ? "" : "unread")}>
                <div className="msg-head">
                  <b>{m.name}</b>
                  <span className={"chip-status " + m.status}>
                    {m.status === "accepted" ? "E PRANUAR" : m.status === "declined" ? "E REFUZUAR" : "NË PRITJE"}
                  </span>
                  {m.vehicle && <span className="chip">{m.vehicle}</span>}
                  {m.service && <span className="chip">{m.service}</span>}
                  <time>{new Date(m.createdAt).toLocaleString("sq")}</time>
                </div>
                <div className="msg-contact">
                  {m.phone && <a href={`tel:${m.phone}`}>{m.phone}</a>}
                  {m.email && <a href={`mailto:${m.email}`}>{m.email}</a>}
                </div>
                {m.message && <p className="msg-text">{m.message}</p>}
                <div className="msg-actions">
                  {m.status !== "accepted" && <button className="accept" onClick={() => decide(m, "accepted")}>Prano porosinë</button>}
                  {m.status !== "declined" && <button className="decline" onClick={() => decide(m, "declined")}>Refuzo</button>}
                  {m.status !== "pending" && <button onClick={() => decide(m, "pending")}>Rihap</button>}
                  <button onClick={() => readToggle(m)}>{m.read ? "Shëno të palexuar" : "Shëno të lexuar"}</button>
                  {m.phone && <a className="btn small" href={`https://wa.me/${m.phone.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
                  {canDelete && <button className="danger" onClick={() => deleteMessage(m)}>Fshi</button>}
                </div>
              </article>
            ))}
            {messages.length === 0 && (
              <div className="empty admin-empty">
                Nuk ka porosi ende. Kur dikush plotëson formën e kontaktit në website, kërkesa shfaqet këtu për t’u pranuar ose refuzuar.
              </div>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------------------------- DESIGNS */}
      {tab === "designs" && canDesigns && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">CONTENT MANAGEMENT</span>
              <h1>Dizajnet.</h1>
            </div>
            <span>{items.length} dizajne</span>
          </div>

          <form className="upload-card" onSubmit={create}>
            <div className="upload-copy">
              <span className="eyebrow">NEW DESIGN</span>
              <h2>Publiko një dizajn.</h2>
              <p>Ngarko foton (opsionale), vendos çmimin dhe kategorinë. Dizajni del menjëherë në website, në të tria gjuhët e navigimit.</p>
            </div>
            <div className="form-grid">
              <input required placeholder="Titulli *" value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <input placeholder="Çmimi, p.sh. 50€" value={form.price} maxLength={60} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
              <input placeholder="Etiketa, p.sh. PUNIM REAL (opsionale)" value={form.badge} maxLength={24} onChange={(e) => setForm({ ...form, badge: e.target.value })} />
              <label className="file-drop">
                <input id="design-image-input" type="file" accept="image/*" onChange={(e) => setForm({ ...form, image: e.target.files?.[0] || null })} />
                <span>{form.image ? form.image.name : "Zgjidh foto (opsionale, max 12MB)"}</span>
              </label>
              <textarea placeholder="Përshkrimi" value={form.description} maxLength={500} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <label className="check"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Dizajn i zgjedhur</label>
              <label className="check"><input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} /> Publik në website</label>
              <button className="btn primary big" disabled={loading}>{loading ? "Duke ruajtur…" : "Publiko dizajnin"}</button>
            </div>
          </form>

          <div className="admin-list">
            {sortedItems.map((d) => (
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
                    {d.featured && <> · <b className="star">I ZGJEDHUR</b></>}
                    {d.badge && <> · {d.badge}</>}
                  </span>
                  <h3>{d.title}</h3>
                  <p>{d.price}{d.description ? ` · ${d.description}` : ""}</p>
                </div>
                <div className="admin-actions">
                  <div className="order-btns">
                    <button title="Ngjite lart" onClick={() => move(d, -1)}>Lart</button>
                    <button title="Zbrite poshtë" onClick={() => move(d, 1)}>Poshtë</button>
                  </div>
                  <button onClick={() => patchDesign({ id: d.id, featured: !d.featured }, d.featured ? "U hoq nga të zgjedhurit." : "U shënua si i zgjedhur.")}>
                    {d.featured ? "Hiq zgjedhjen" : "Zgjidh"}
                  </button>
                  <button onClick={() => patchDesign({ id: d.id, visible: !d.visible }, d.visible ? "Dizajni u fsheh." : "Dizajni u publikua.")}>
                    {d.visible ? "Fshih" : "Publiko"}
                  </button>
                  <button onClick={() => startEdit(d)}>Ndrysho</button>
                  {canDelete && <button className="danger" onClick={() => removeDesign(d)}>Fshi</button>}
                </div>
              </article>
            ))}
            {items.length === 0 && <div className="empty admin-empty">Ende nuk ke dizajne. Publiko të parin më sipër.</div>}
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
                <input value={editForm.price} maxLength={60} placeholder="p.sh. 50€" onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} />
                <label>Kategoria</label>
                <select value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <label>Etiketa</label>
                <input value={editForm.badge} maxLength={24} placeholder="p.sh. PUNIM REAL" onChange={(e) => setEditForm({ ...editForm, badge: e.target.value })} />
                <label>Përshkrimi</label>
                <textarea value={editForm.description} maxLength={500} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                <label>Zëvendëso foton</label>
                <label className="file-drop">
                  <input type="file" accept="image/*" onChange={(e) => setEditForm({ ...editForm, image: e.target.files?.[0] || null })} />
                  <span>{editForm.image ? editForm.image.name : "Foto e re (opsionale)"}</span>
                </label>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setEditing(null)}>Anulo</button>
                  <button className="btn primary" disabled={loading}>{loading ? "Duke ruajtur…" : "Ruaj ndryshimet"}</button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------- SETTINGS */}
      {tab === "settings" && canDesigns && settings && (
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
              <h3>Ballina — shqip</h3>
              <div className="settings-grid">
                <label className="wide">Teksti i vogël (eyebrow)<input value={settings.heroEyebrow} onChange={(e) => setSettings({ ...settings, heroEyebrow: e.target.value })} /></label>
                <label>Titulli (rreshti 1)<input value={settings.heroTitle} onChange={(e) => setSettings({ ...settings, heroTitle: e.target.value })} /></label>
                <label>Titulli i theksuar (rreshti 2)<input value={settings.heroHighlight} onChange={(e) => setSettings({ ...settings, heroHighlight: e.target.value })} /></label>
                <label className="wide">Nëntitulli<textarea rows={3} value={settings.heroSubtitle} onChange={(e) => setSettings({ ...settings, heroSubtitle: e.target.value })} /></label>
                <label className="wide">Rreth nesh<textarea rows={3} value={settings.about} onChange={(e) => setSettings({ ...settings, about: e.target.value })} /></label>
              </div>
            </div>
            <div className="settings-group">
              <h3>Ballina — english & deutsch (opsionale, nëse lihen bosh përdoret versioni shqip)</h3>
              <div className="settings-grid">
                <label>EN titulli<input value={settings.heroTitleEn} onChange={(e) => setSettings({ ...settings, heroTitleEn: e.target.value })} /></label>
                <label>EN titulli i theksuar<input value={settings.heroHighlightEn} onChange={(e) => setSettings({ ...settings, heroHighlightEn: e.target.value })} /></label>
                <label className="wide">EN nëntitulli<textarea rows={2} value={settings.heroSubtitleEn} onChange={(e) => setSettings({ ...settings, heroSubtitleEn: e.target.value })} /></label>
                <label>DE titulli<input value={settings.heroTitleDe} onChange={(e) => setSettings({ ...settings, heroTitleDe: e.target.value })} /></label>
                <label>DE titulli i theksuar<input value={settings.heroHighlightDe} onChange={(e) => setSettings({ ...settings, heroHighlightDe: e.target.value })} /></label>
                <label className="wide">DE nëntitulli<textarea rows={2} value={settings.heroSubtitleDe} onChange={(e) => setSettings({ ...settings, heroSubtitleDe: e.target.value })} /></label>
                <label className="wide">EN rreth nesh<textarea rows={2} value={settings.aboutEn} onChange={(e) => setSettings({ ...settings, aboutEn: e.target.value })} /></label>
                <label className="wide">DE rreth nesh<textarea rows={2} value={settings.aboutDe} onChange={(e) => setSettings({ ...settings, aboutDe: e.target.value })} /></label>
              </div>
            </div>
            <div className="settings-group">
              <h3>Pamja</h3>
              <div className="settings-grid">
                <label>Ngjyra e theksit
                  <span className="accent-row">
                    <input type="color" value={settings.accent} onChange={(e) => setSettings({ ...settings, accent: e.target.value })} />
                    <code>{settings.accent}</code>
                  </span>
                </label>
              </div>
            </div>
            <div className="settings-actions">
              <button className="btn primary big" disabled={loading}>{loading ? "Duke ruajtur…" : "Ruaj cilësimet"}</button>
              <a className="btn" href="/" target="_blank" rel="noopener noreferrer">Shiko website-in</a>
            </div>
            {canReset && (
              <div className="danger-zone">
                <h3>Zona e rrezikut — vetëm Owner</h3>
                <p>Fshin përgjithmonë dizajnet, mesazhet, statistikat dhe cilësimet. Llogaritë mbeten.</p>
                <button type="button" className="btn danger" onClick={resetSite}>Fshi gjithë përmbajtjen</button>
              </div>
            )}
          </form>
        </section>
      )}

      {/* -------------------------------------------------- ACCOUNTS */}
      {tab === "accounts" && canAccounts && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">TEAM MANAGEMENT</span>
              <h1>Llogaritë.</h1>
            </div>
            <span>{accounts.length} llogari</span>
          </div>

          <form className="upload-card" onSubmit={createAccount}>
            <div className="upload-copy">
              <span className="eyebrow">NEW ACCOUNT</span>
              <h2>Shto një llogari.</h2>
              <p>
                Rolet: Staff (vetëm pranon/refuzon porosi), Admin (gjithçka pa log), Co Owner (gjithçka + log + Staff/Admin, pa fshirje), Owner (absolut).
              </p>
            </div>
            <div className="form-grid">
              <input required placeholder="Emri i përdoruesit *" value={accForm.username} maxLength={40} onChange={(e) => setAccForm({ ...accForm, username: e.target.value })} />
              <input required placeholder="Fjalëkalimi * (6+ shkronja)" type="password" value={accForm.password} maxLength={200} onChange={(e) => setAccForm({ ...accForm, password: e.target.value })} />
              <select value={accForm.role} onChange={(e) => setAccForm({ ...accForm, role: e.target.value as Role })}>
                {creatable.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
              <button className="btn primary big" disabled={loading || creatable.length === 0}>
                {loading ? "Duke ruajtur…" : "Krijo llogarinë"}
              </button>
            </div>
          </form>

          <div className="admin-list">
            {accounts.map((a) => (
              <article key={a.id} className="admin-item account-item">
                <div className="account-avatar">{a.username.slice(0, 2).toUpperCase()}</div>
                <div className="admin-item-body">
                  <span className="admin-item-meta">
                    <b className="ok">{ROLE_LABELS[a.role]}</b> · krijuar nga {a.createdBy} · {new Date(a.createdAt).toLocaleDateString("sq")}
                  </span>
                  <h3>{a.username}</h3>
                  <p>{a.username === me.username ? "Kjo është llogaria jote" : "Anëtar i ekipit"}</p>
                </div>
                <div className="admin-actions">
                  <button
                    onClick={() => {
                      setAccEdit(a);
                      setAccEditForm({ username: a.username, password: "", role: a.role });
                    }}
                  >
                    Ndrysho
                  </button>
                  {a.username !== me.username && (
                    <button className="danger" onClick={() => deleteAccount(a)}>Fshi</button>
                  )}
                </div>
              </article>
            ))}
          </div>

          {accEdit && (
            <div className="modal-backdrop" onClick={() => setAccEdit(null)}>
              <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveAccEdit}>
                <span className="eyebrow">EDIT ACCOUNT</span>
                <h2>Llogaria {accEdit.username}</h2>
                <label>Emri i përdoruesit</label>
                <input value={accEditForm.username} maxLength={40} onChange={(e) => setAccEditForm({ ...accEditForm, username: e.target.value })} />
                <label>Fjalëkalim i ri (bosh = mbetet i njëjti)</label>
                <input type="password" placeholder="Fjalëkalim i ri" value={accEditForm.password} maxLength={200} onChange={(e) => setAccEditForm({ ...accEditForm, password: e.target.value })} />
                <label>Roli</label>
                <select value={accEditForm.role} onChange={(e) => setAccEditForm({ ...accEditForm, role: e.target.value as Role })}>
                  {(me.role === "owner" ? (["staff", "admin", "coowner", "owner"] as Role[]) : (["staff", "admin"] as Role[])).map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <div className="modal-actions">
                  <button type="button" className="btn" onClick={() => setAccEdit(null)}>Anulo</button>
                  <button className="btn primary" disabled={loading}>{loading ? "Duke ruajtur…" : "Ruaj"}</button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------------ LOGS */}
      {tab === "logs" && canLogs && (
        <section className="admin-content">
          <div className="admin-title">
            <div>
              <span className="eyebrow">AUDIT TRAIL</span>
              <h1>Audit Log.</h1>
            </div>
            <button className="btn small" onClick={loadLogs}>Rifresko</button>
          </div>
          <div className="logs-wrap">
            <table className="logs-table">
              <thead>
                <tr><th>Koha</th><th>Përdoruesi</th><th>Roli</th><th>Veprimi</th><th>Detaji</th><th>IP</th></tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className={l.action.includes("delete") || l.action.includes("reset") ? "log-danger" : l.action.includes("login") ? "log-login" : ""}>
                    <td>{new Date(l.at).toLocaleString("sq")}</td>
                    <td><b>{l.actor}</b></td>
                    <td>{l.role}</td>
                    <td><code>{l.action}</code></td>
                    <td>{l.detail}</td>
                    <td>{l.ip}</td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr><td colSpan={6} className="logs-empty">Ende nuk ka veprime të regjistruara.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* --------------------------------------------------- PROFILE */}
      {profileOpen && (
        <div className="modal-backdrop" onClick={() => setProfileOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={saveProfile}>
            <span className="eyebrow">MY PROFILE</span>
            <h2>Profili im — {me.username}</h2>
            <label>Emri i ri (opsionale)</label>
            <input placeholder={me.username} value={profileForm.username} maxLength={40} onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })} />
            <label>Fjalëkalimi aktual (nevojitet për ndryshime)</label>
            <input type="password" value={profileForm.currentPassword} maxLength={200} onChange={(e) => setProfileForm({ ...profileForm, currentPassword: e.target.value })} />
            <label>Fjalëkalimi i ri (opsionale, 6+ shkronja)</label>
            <input type="password" value={profileForm.newPassword} maxLength={200} onChange={(e) => setProfileForm({ ...profileForm, newPassword: e.target.value })} />
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => setProfileOpen(false)}>Anulo</button>
              <button className="btn primary" disabled={loading}>{loading ? "Duke ruajtur…" : "Ruaj profilin"}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
