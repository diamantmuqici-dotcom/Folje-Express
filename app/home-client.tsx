"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Design, SiteSettings } from "@/lib/store";
import { LANGS, LANG_LABELS, translate, type Lang } from "@/lib/i18n";
import HeroScene from "@/components/HeroScene";
import ColorLab from "@/components/ColorLab";

const LOGO = "/logo.png";
const FILTER_KEYS = ["designs.all", "Makina", "Motoçikleta", "Të dyja"] as const;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
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

const SWATCHES = ["swatch-a", "swatch-b", "swatch-c", "swatch-d", "swatch-e", "swatch-f"];

function DesignCard({
  d,
  index,
  settings,
  lang,
}: {
  d: Design;
  index: number;
  settings: SiteSettings;
  lang: Lang;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

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
    ref.current?.style.setProperty("--rx", "0deg");
    ref.current?.style.setProperty("--ry", "0deg");
  };

  const orderText =
    lang === "en"
      ? `Hello ${settings.businessName}! I would like to order the design "${d.title}" (${d.category}). Can I get the price and timeframe?`
      : lang === "de"
        ? `Hallo ${settings.businessName}! Ich möchte das Design "${d.title}" (${d.category}) bestellen. Preis und Dauer bitte?`
        : `Përshëndetje ${settings.businessName}! Dua të porosit dizajnin "${d.title}" (${d.category}). A mund të më tregoni çmimin dhe afatin?`;

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
          <img src={d.image} alt={`${d.title} — ${d.category} · ${settings.businessName}`} loading="lazy" />
        ) : (
          <div className={"foil-swatch " + SWATCHES[index % SWATCHES.length]} />
        )}
        <div className="design-glare" />
        {d.badge && <span className="badge">{d.badge}</span>}
        {d.featured && <span className="badge featured">{t("designs.featured")}</span>}
        <span className="category">{d.category}</span>
      </div>
      <div className="design-body">
        <div className="design-number">{settings.businessName}</div>
        <h3>{d.title}</h3>
        {d.description && <p>{d.description}</p>}
        <div className="design-foot">
          <strong>{d.price}</strong>
          <div className="design-actions">
            <a className="btn small primary" href={waLink(settings, orderText)} target="_blank" rel="noopener noreferrer">
              {t("designs.order")}
            </a>
            <a className="btn small" href="#contact">
              {t("designs.quote")}
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

function ContactForm({ settings, lang }: { settings: SiteSettings; lang: Lang }) {
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

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
        setError(data.error || t("form.error"));
        return;
      }
      setStatus("ok");
      e.currentTarget.reset();
    } catch {
      setStatus("error");
      setError(t("form.error"));
    }
  }

  if (status === "ok") {
    return (
      <div className="form-success">
        <h3>{t("form.okTitle")}</h3>
        <p>{t("form.okText", { biz: settings.businessName })}</p>
        <button className="btn" onClick={() => setStatus("idle")}>
          {t("form.okAgain")}
        </button>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={submit}>
      <div className="form-row">
        <input name="name" required placeholder={t("form.name")} maxLength={80} autoComplete="name" />
        <input name="phone" placeholder={t("form.phone")} maxLength={40} autoComplete="tel" />
      </div>
      <div className="form-row">
        <input name="email" type="email" placeholder={t("form.email")} maxLength={120} autoComplete="email" />
        <input name="vehicle" placeholder={t("form.vehicle")} maxLength={80} />
      </div>
      <select name="service" defaultValue={t("form.service1")}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <option key={i}>{t(`form.service${i}`)}</option>
        ))}
      </select>
      <textarea name="message" placeholder={t("form.message")} maxLength={1000} rows={4} />
      {/* honeypot — humans never see or fill this */}
      <input name="company" tabIndex={-1} autoComplete="off" className="hp" aria-hidden="true" />
      {status === "error" && <small className="form-error">{error}</small>}
      <button className="btn primary big" type="submit" disabled={status === "sending"}>
        {status === "sending" ? t("form.sending") : t("form.send")}
      </button>
      <small className="form-note">{t("form.note")}</small>
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
  const [lang, setLang] = useState<Lang>("sq");
  const [menu, setMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const revealRef = useReveal();

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined" && localStorage.getItem("folje_lang")) as Lang | null;
    if (stored && LANGS.includes(stored)) setLang(stored);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("folje_lang", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", settings.accent || "#5bc7ff");
  }, [settings.accent]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    fetch("/api/track", { method: "POST" }).catch(() => {});
  }, []);

  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);
  /* admin copy with per-language overrides (En / De), falling back to SQ */
  const pick = (base: "heroTitle" | "heroHighlight" | "heroSubtitle" | "about") => {
    const suffix = lang === "en" ? "En" : lang === "de" ? "De" : "";
    const value = suffix ? (settings as Record<string, string>)[base + suffix] : "";
    return value && value.trim() ? value : settings[base];
  };

  const designs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return initialDesigns.filter((d) => {
      const inFilter = filter === "all" || d.category === filter;
      const inQuery = !q || `${d.title} ${d.description} ${d.category} ${d.badge}`.toLowerCase().includes(q);
      return inFilter && inQuery;
    });
  }, [initialDesigns, filter, query]);

  const featured = initialDesigns.filter((d) => d.featured).length;
  const filterValue = filter === "all" ? t("designs.all") : filter;

  return (
    <main ref={revealRef}>
      {/* NAV */}
      <header className={"nav " + (scrolled ? "scrolled" : "")}>
        <a className="brand" href="#home" aria-label={settings.businessName}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={LOGO} alt={settings.businessName} />
          <span>
            {settings.businessName}
            <small>{settings.tagline}</small>
          </span>
        </a>
        <button className={"menu " + (menu ? "open" : "")} onClick={() => setMenu(!menu)} aria-label="Menu">
          <i /><i /><i />
        </button>
        <nav className={menu ? "open" : ""}>
          <a href="#home" onClick={() => setMenu(false)}>{t("nav.home")}</a>
          <a href="#designs" onClick={() => setMenu(false)}>{t("nav.designs")}</a>
          <a href="#color-lab" onClick={() => setMenu(false)}>{t("nav.lab")}</a>
          <a href="#process" onClick={() => setMenu(false)}>{t("nav.process")}</a>
          <a href="#contact" onClick={() => setMenu(false)}>{t("nav.contact")}</a>
          <div className="lang-switch" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l} className={lang === l ? "active" : ""} onClick={() => setLang(l)}>
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
          <a
            className="btn small primary"
            href={waLink(settings, lang === "en" ? `Hello ${settings.businessName}! I need info about your wraps.` : lang === "de" ? `Hallo ${settings.businessName}! Ich brauche Infos zu euren Folien.` : `Përshëndetje ${settings.businessName}! Dua informacion për foljet.`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setMenu(false)}
          >
            {t("nav.whatsapp")}
          </a>
        </nav>
      </header>

      {/* HERO */}
      <section id="home" className="hero">
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-glow a" />
          <div className="hero-glow b" />
          <div className="stage-grid" />
        </div>
        <div className="hero-copy reveal in">
          <span className="eyebrow pulse-dot">{settings.heroEyebrow}</span>
          <h1>
            {pick("heroTitle")}
            <br />
            <em>{pick("heroHighlight")}</em>
          </h1>
          <p>{pick("heroSubtitle")}</p>
          <div className="actions">
            <a className="btn primary big" href="#designs">
              {t("hero.ctaDesigns")}
            </a>
            <a className="btn big" href="#color-lab">
              {t("hero.ctaLab")}
            </a>
          </div>
          <div className="trust">
            <span><b>01</b> {t("hero.trust1")}</span><i />
            <span><b>02</b> {t("hero.trust2")}</span><i />
            <span><b>03</b> {t("hero.trust3")}</span>
          </div>
        </div>
        <div className="hero-stage reveal in">
          <HeroScene accent={settings.accent} />
          <div className="stage-label"><b>3D</b> {settings.businessName}</div>
          <div className="stage-orbit">{t("hero.stage")}</div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {Array.from({ length: 2 }).map((_, k) => (
            <div className="marquee-row" key={k}>
              {["FOLJE EXPRESS", "CAR WRAP", "NDËRRIM NGJYRE", "MATTE / GLOSS / SATIN / CHROME", "MOTOÇIKLETA", "PPF MBROJTJE", "DIZAJNE CUSTOM", "FOLJEEXPRESS"].map((x) => (
                <span key={x}>{x} /</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* DESIGNS */}
      <section id="designs" className="section designs">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">{t("designs.eyebrow")}</span>
            <h2>{t("designs.title")} <em>{t("designs.titleEm")}</em></h2>
          </div>
          <p>{t("designs.subtitle", { biz: settings.businessName })}</p>
        </div>
        <div className="designs-toolbar reveal">
          <div className="filters">
            {FILTER_KEYS.map((k) => {
              const value = k === "designs.all" ? "all" : k;
              const label = k === "designs.all" ? t("designs.all") : k;
              return (
                <button className={filter === value ? "active" : ""} key={k} onClick={() => setFilter(value)}>
                  {label}
                </button>
              );
            })}
          </div>
          <div className="search">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("designs.search")}
              aria-label={t("designs.search")}
            />
            {query && (
              <button className="clear" onClick={() => setQuery("")}>
                {t("designs.clear")}
              </button>
            )}
          </div>
        </div>
        <div className="design-grid">
          {designs.length ? (
            designs.map((d, i) => <DesignCard key={d.id} d={d} index={i} settings={settings} lang={lang} />)
          ) : (
            <div className="empty reveal in">
              <b>{t("designs.emptyTitle")}</b>
              <p>{t("designs.emptyText")}</p>
              <a className="btn primary" href="#contact">{t("designs.emptyCta")}</a>
            </div>
          )}
        </div>
        {featured > 0 && (
          <p className="designs-note reveal">
            {featured} {t("designs.featuredNote", { s: featured > 1 ? "e" : "" , e: featured > 1 ? "e" : "" })}
          </p>
        )}
      </section>

      {/* COLOR LAB */}
      <section id="color-lab" className="section lab">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">{t("lab.eyebrow")}</span>
            <h2>{t("lab.title")} <em>{t("lab.titleEm")}</em></h2>
          </div>
          <p>{t("lab.subtitle", { biz: settings.businessName })}</p>
        </div>
        <div className="reveal">
          <ColorLab lang={lang} />
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="section process">
        <div className="section-head reveal">
          <div>
            <span className="eyebrow">{t("process.eyebrow")}</span>
            <h2>{t("process.title")} <em>{t("process.titleEm")}</em></h2>
          </div>
        </div>
        <div className="steps">
          {[1, 2, 3, 4].map((i, idx) => (
            <div className="step reveal" key={i} style={{ transitionDelay: `${idx * 80}ms` }}>
              <b>0{i}</b>
              <h3>{t(`process.s${i}t`)}</h3>
              <p>{t(`process.s${i}p`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="section about">
        <div className="about-card reveal">
          <div className="about-copy">
            <span className="eyebrow">{t("about.eyebrow")} — {settings.businessName}</span>
            <h2>
              {t("about.title")}
              <br />
              <em>{t("about.titleEm")}</em>
            </h2>
            <p>{pick("about")}</p>
            <ul className="about-list">
              {[1, 2, 3, 4].map((i) => (
                <li key={i}>{t(`about.l${i}`)}</li>
              ))}
            </ul>
          </div>
          <div className="about-stats">
            {[
              { k: "100%", v: t("about.st1") },
              { k: "24h", v: t("about.st2") },
              { k: "1000+", v: t("about.st3") },
            ].map((x) => (
              <div key={x.v}>
                <strong>{x.k}</strong>
                <span>{x.v}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="section contact-section">
        <div className="contact-head reveal">
          <span className="eyebrow">{settings.businessName} / {t("contact.eyebrow")}</span>
          <h2>
            {t("contact.title")}
            <br />
            <em>{t("contact.titleEm")}</em>
          </h2>
          <p>{t("contact.subtitle")}</p>
          <div className="contact-info">
            <a href={`tel:${settings.phone.replace(/\s/g, "")}`}><b>Tel</b> {settings.phone}</a>
            {settings.email && <a href={`mailto:${settings.email}`}><b>Email</b> {settings.email}</a>}
            <span><b>Adr</b> {settings.address}</span>
            <span><b>Orari</b> {settings.hours}</span>
          </div>
          <div className="contact-socials">
            {settings.instagram && (
              <a href={`https://instagram.com/${settings.instagram.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">Instagram</a>
            )}
            {settings.tiktok && (
              <a href={`https://tiktok.com/@${settings.tiktok.replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">TikTok</a>
            )}
            {settings.whatsapp && (
              <a href={waLink(settings, "Përshëndetje!")} target="_blank" rel="noopener noreferrer">WhatsApp</a>
            )}
          </div>
        </div>
        <div className="reveal">
          <ContactForm settings={settings} lang={lang} />
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="footer-top">
          <div className="footer-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt={settings.businessName} />
            <div>
              <b>{settings.businessName}</b>
              <span>{settings.tagline} — {t("footer.tagline")}</span>
            </div>
          </div>
          <nav className="footer-nav">
            <a href="#designs">{t("nav.designs")}</a>
            <a href="#color-lab">{t("nav.lab")}</a>
            <a href="#process">{t("nav.process")}</a>
            <a href="#contact">{t("nav.contact")}</a>
            <a href="/admin">Admin</a>
          </nav>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} {settings.businessName}. {t("footer.rights")}</span>
          <span className="footer-seo" aria-hidden="true">folje · folje express · foljeexpress · car wrap</span>
          <a href="#home">{t("footer.top")}</a>
        </div>
      </footer>
    </main>
  );
}
