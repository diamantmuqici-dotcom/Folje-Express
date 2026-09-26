"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Design, SiteSettings } from "@/lib/store";
import HeroScene from "@/components/HeroScene";
import ColorLab from "@/components/ColorLab";

const LOGO = "/logo.png";
const FILTERS = ["Të gjitha", "Makina", "Motoçikleta", "Të dyja"] as const;

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

function waLink(settings: SiteSettings, text: string) {
  const num = settings.whatsapp.replace(/[^0-9]/g, "");
  return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
}

function useReveal() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll(".reveal");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/* ------------------------------------------------------------------ */
/* Design card with 3D tilt + hover glare                              */
/* ------------------------------------------------------------------ */

const SWATCHES = ["swatch-a", "swatch-b", "swatch-c", "swatch-d", "swatch-e", "swatch-f"];

function DesignCard({ d, index, settings }: { d: Design; index: number; settings: SiteSettings }) {
  const ref = useRef<HTMLElement | null>(null);

  const onMove = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--rx", `${(-py * 9).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(px * 11).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${((px + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--gy", `${((py + 0.5) * 100).toFixed(1)}%`);
  };
  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  const orderText = `Përshëndetje ${settings.businessName}! Dua të porosit dizajnin "${d.title}" (${d.category}). A mund të më tregoni çmimin dhe afatin?`;

  return (
    <article
      className="design-card reveal"
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={{ transitionDelay: `${(index % 3) * 70}ms` }}
    >
      <div className="design-image">
        {d.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image} alt={`${d.title} — folje ${d.category.toLowerCase()} nga ${settings.businessName}`} loading="lazy" />
        ) : (
          <div className={"foil-swatch " + SWATCHES[index % SWATCHES.length]} />
        )}
        <div className="design-glare" />
        {d.badge && <span className="badge">{d.badge}</span>}
        {d.featured && <span className="badge featured">★ ZGJEDHJA JONË</span>}
        <span className="category">{d.category}</span>
      </div>
      <div className="design-body">
        <div className="design-number">FOLJE EXPRESS</div>
        <h3>{d.title}</h3>
        {d.description && <p>{d.description}</p>}
        <div className="design-foot">
          <strong>{d.price}</strong>
          <div className="design-actions">
            <a className="btn small primary" href={waLink(settings, orderText)} target="_blank" rel="noopener noreferrer">
              Porosit
            </a>
            <a className="btn small" href="#contact">
              Ofertë
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Contact form                                                        */
/* ------------------------------------------------------------------ */

function ContactForm({ settings }: { settings: SiteSettings }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    const fd = new FormData(e.currentTarget);
    const payload = Object.fromEntries(fd.entries());
    try {
      const r = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatus("error");
        setError(data.error || "Diçka shkoi keq. Provo përsëri.");
        return;
      }
      setStatus("ok");
      e.currentTarget.reset();
    } catch {
      setStatus("error");
      setError("Nuk u dërgua. Kontrollo lidhjen e internetit.");
    }
  }

  if (status === "ok") {
    return (
      <div className="form-success">
        <div className="form-success-icon">✓</div>
        <h3>Mesazhi u dërgua!</h3>
        <p>Faleminderit — {settings.businessName} do të kontaktohet me ty shumë shpejt.</p>
        <button className="btn" onClick={() => setStatus("idle")}>
          Dërgo një mesazh tjetër
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-row">
        <input name="name" required placeholder="Emri *" maxLength={80} autoComplete="name" />
        <input name="phone" placeholder="Telefoni *" maxLength={40} autoComplete="tel" />
      </div>
      <div className="form-row">
        <input name="email" type="email" placeholder="Email" maxLength={120} autoComplete="email" />
        <input name="vehicle" placeholder="Makina / Motoçikleta (p.sh. BMW E46)" maxLength={80} />
      </div>
      <select name="service" defaultValue="Ndërrim ngjyre (wrap)">
        <option>Ndërrim ngjyre (wrap)</option>
        <option>Dizajn custom</option>
        <option>PPF — mbrojtje boje</option>
        <option>Folie motoçiklete</option>
        <option>Detaje / aksesorë</option>
        <option>Tjetër</option>
      </select>
      <textarea name="message" placeholder="Shkruaj mesazhin tënd…" maxLength={1000} rows={4} />
      {/* honeypot — humans never see or fill this */}
      <input name="company" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" placeholder="Mos e plotëso" />
      {status === "error" && <small className="form-error">{error}</small>}
      <button className="btn primary big" type="submit" disabled={status === "sending"}>
        {status === "sending" ? "Duke dërguar…" : "Dërgo kërkesën ↗"}
      </button>
      <small className="form-note">Përgjigjemi zakonisht brenda pak orësh. Asnjë spam.</small>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function HomeClient({
  initialDesigns,
  settings,
}: {
  initialDesigns: Design[];
  settings: SiteSettings;
}) {
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [filter, setFilter] = useState<string>("Të gjitha");
  const [query, setQuery] = useState("");
  const revealRef = useReveal();

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent || "#5bc7ff");
  }, [settings.accent]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* anonymous visit beacon — powers the admin stats tab */
  useEffect(() => {
    fetch("/api/track", { method: "POST" }).catch(() => {});
  }, []);

  const designs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialDesigns.filter((d) => {
      const inFilter = filter === "Të gjitha" || d.category === filter;
      const inQuery = !q || `${d.title} ${d.description} ${d.category} ${d.badge}`.toLowerCase().includes(q);
      return inFilter && inQuery;
    });
  }, [initialDesigns, filter, query]);

  const featured = initialDesigns.filter((d) => d.featured).length;

  return (
    <main ref={revealRef}>
      {/* ---------------------------------------------------------- NAV */}
      <header className={"nav " + (scrolled ? "scrolled" : "")}>
        <a className="brand" href="#home" aria-label={settings.businessName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt={settings.businessName} />
          <span>
            {settings.businessName}
            <small>{settings.tagline}</small>
          </span>
        </a>
        <button className={"menu " + (menu ? "open" : "")} onClick={() => setMenu(!menu)} aria-label="Hap menunë">
          <i /><i /><i />
        </button>
        <nav className={menu ? "open" : ""}>
          <a href="#home" onClick={() => setMenu(false)}>Ballina</a>
          <a href="#designs" onClick={() => setMenu(false)}>Dizajnet</a>
          <a href="#color-lab" onClick={() => setMenu(false)}>Color Lab 3D</a>
          <a href="#process" onClick={() => setMenu(false)}>Procesi</a>
          <a href="#contact" onClick={() => setMenu(false)}>Kontakt</a>
          <a className="btn small primary" href={waLink(settings, `Përshëndetje ${settings.businessName}! Dua informacion për folje.`)} target="_blank" rel="noopener noreferrer" onClick={() => setMenu(false)}>
            WhatsApp ↗
          </a>
        </nav>
      </header>

      {/* --------------------------------------------------------- HERO */}
      <section id="home" className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-glow a" />
          <div className="hero-glow b" />
          <div className="stage-grid" />
        </div>
        <div className="hero-copy reveal in">
          <span className="eyebrow pulse-dot">{settings.heroEyebrow}</span>
          <h1>
            {settings.heroTitle}
            <br />
            <em>{settings.heroHighlight}</em>
          </h1>
          <p>{settings.heroSubtitle}</p>
          <div className="actions">
            <a className="btn primary big" href="#designs">
              Shiko dizajnet <span>↗</span>
            </a>
            <a className="btn big" href="#color-lab">
              Provo Color Lab 3D
            </a>
          </div>
          <div className="trust">
            <span><b>01</b> DESIGN</span><i />
            <span><b>02</b> FOIL</span><i />
            <span><b>03</b> FINISH</span>
          </div>
        </div>
        <div className="hero-stage reveal in">
          <HeroScene accent={settings.accent} />
          <div className="stage-label"><b>3D</b> {settings.businessName}</div>
          <div className="stage-orbit">INTERAKTIVE / LËVIZ MAUSIN</div>
        </div>
      </section>

      {/* ------------------------------------------------------ MARQUEE */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <div className="marquee-row" key={k}>
              {["FOLJE EXPRESS", "CAR WRAP", "NDËRRIM NGJYRE", "MATTE · GLOSS · SATIN · CHROME", "MOTOÇIKLETA", "PPF MBROJTJE", "DIZAJNE CUSTOM", "FOLJEEXPRESS"].map((t) => (
                <span key={t}>{t} ✦</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ----------------------------------------------------- DESIGNS */}
      <section id="designs" className="section designs">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">DESIGN LIBRARY</span>
            <h2>Dizajnet <em>tona.</em></h2>
          </div>
          <p>
            Folje të publikuara nga {settings.businessName} — foto, çmime dhe përshkrime të
            përditësuara. Kërko ose filtro sipas kategorisë.
          </p>
        </div>
        <div className="designs-toolbar reveal">
          <div className="filters">
            {FILTERS.map((x) => (
              <button className={filter === x ? "active" : ""} key={x} onClick={() => setFilter(x)}>
                {x}
              </button>
            ))}
          </div>
          <div className="search">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kërko dizajn, ngjyrë, folje…"
              aria-label="Kërko dizajne"
            />
            {query && <button className="clear" onClick={() => setQuery("")} aria-label="Pastro kërkimin">✕</button>}
          </div>
        </div>
        <div className="design-grid">
          {designs.length ? (
            designs.map((d, i) => <DesignCard key={d.id} d={d} index={i} settings={settings} />)
          ) : (
            <div className="empty reveal in">
              <b>Asnjë rezultat.</b>
              <p>Nuk ka dizajne për “{query || filter}”. Provo një kërkim tjetër ose na kontakto për porosi custom.</p>
              <a className="btn primary" href="#contact">Kërko dizajn custom</a>
            </div>
          )}
        </div>
        {featured > 0 && (
          <p className="designs-note reveal">★ {featured} dizajn{featured > 1 ? "e" : ""} i/e zgjedhur nga ekipi ynë</p>
        )}
      </section>

      {/* ---------------------------------------------------- COLOR LAB */}
      <section id="color-lab" className="section lab">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">3D WRAP VISUALIZER</span>
            <h2>Color <em>Lab.</em></h2>
          </div>
          <p>
            Zgjidh finiturën e foljes dhe shikoje drejtpërdrejt në 3D — gloss, matte, satin,
            krom ose flip. Ekskluzivisht te {settings.businessName}.
          </p>
        </div>
        <div className="reveal">
          <ColorLab />
        </div>
      </section>

      {/* ------------------------------------------------------ PROCESS */}
      <section id="process" className="section process">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">SI FUNKSIONON</span>
            <h2>Ngjyra. Dizajn. <em>Aplikim.</em></h2>
          </div>
        </div>
        <div className="steps">
          {[
            { n: "01", t: "Zgjedh stilin", p: "Shfleto dizajnet ose provo Color Lab 3D dhe zgjidh ngjyrën që të përfaqëson." },
            { n: "02", t: "Përgatitja", p: "Folia pritet dhe përgatitet me precizion për automjetin tënd — pa surpriza." },
            { n: "03", t: "Aplikimi", p: "Aplikim i pastër, me fokus te detajet, dhe përfundim që të kthen kokat." },
            { n: "04", t: "Mbrojtja", p: "Opsionalisht shtojmë shtresë mbrojtëse (PPF) që ngjyra të zgjasë me vite." },
          ].map((s, i) => (
            <div className="step reveal" key={s.n} style={{ transitionDelay: `${i * 80}ms` }}>
              <b>{s.n}</b>
              <h3>{s.t}</h3>
              <p>{s.p}</p>
            </div>
          ))}
        </div>
      </section>

      {/* -------------------------------------------------------- ABOUT */}
      <section id="about" className="section about">
        <div className="about-card reveal">
          <div className="about-copy">
            <span className="eyebrow">PSE {settings.businessName.toUpperCase()}</span>
            <h2>Cilësi premium,<br /><em>çdo ditë.</em></h2>
            <p>{settings.about}</p>
            <ul className="about-list">
              <li><b>✓</b> Materiale premium me garanci</li>
              <li><b>✓</b> Aplikim profesional pa flluska</li>
              <li><b>✓</b> Dizajne custom sipas dëshirës</li>
              <li><b>✓</b> Çmime transparente — pa pagesa të fshehura</li>
            </ul>
          </div>
          <div className="about-stats">
            {[
              { k: "100%", v: "Përkushtim në detaje" },
              { k: "24h", v: "Përgjigje mesazheve" },
              { k: "∞", v: "Kombinime ngjyrash" },
            ].map((x) => (
              <div key={x.v}>
                <strong>{x.k}</strong>
                <span>{x.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ CONTACT */}
      <section id="contact" className="section contact-section">
        <div className="contact-head reveal">
          <span className="eyebrow">{settings.businessName} / KONTAKT</span>
          <h2>Gati për një<br /><em>pamje tjetër?</em></h2>
          <p>Dërgo kërkesën dhe merr ofertë shpejt. Ose na shkruaj direkt në WhatsApp.</p>
          <div className="contact-info">
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`}>📞 {settings.phone}</a>
            {settings.email && <a href={`mailto:${settings.email}`}>✉️ {settings.email}</a>}
            <span>📍 {settings.address}</span>
            <span>🕘 {settings.hours}</span>
          </div>
          <div className="contact-socials">
            {settings.instagram && <a href={`https://instagram.com/${settings.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">Instagram</a>}
            {settings.tiktok && <a href={`https://tiktok.com/@${settings.tiktok.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">TikTok</a>}
            {settings.whatsapp && <a href={waLink(settings, "Përshëndetje! Dua informacion për folje.")} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          </div>
        </div>
        <div className="reveal">
          <ContactForm settings={settings} />
        </div>
      </section>

      {/* ------------------------------------------------------- FOOTER */}
      <footer>
        <div className="footer-top">
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt={settings.businessName} />
            <div>
              <b>{settings.businessName}</b>
              <span>{settings.tagline} — folje, wrap & dizajne custom.</span>
            </div>
          </div>
          <nav className="footer-nav">
            <a href="#designs">Dizajnet</a>
            <a href="#color-lab">Color Lab 3D</a>
            <a href="#process">Procesi</a>
            <a href="#contact">Kontakt</a>
            <a href="/admin">Admin</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {settings.businessName}. Të gjitha të drejtat e rezervuara.</span>
          <span className="footer-seo" aria-hidden="true">folje · folje express · foljeexpress · car wrap</span>
          <a href="#home">Lart ↑</a>
        </div>
      </footer>
    </main>
  );
}
