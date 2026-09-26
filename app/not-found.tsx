import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 — Faqja nuk u gjet",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="admin-shell">
      <div className="admin-login" style={{ textAlign: "center", alignItems: "center" }}>
        <div className="admin-login-bg" aria-hidden="true" />
        <span className="eyebrow">FOLJE EXPRESS / 404</span>
        <h1 style={{ fontSize: 96, margin: "10px 0" }}>404</h1>
        <p>Kjo faqe nuk ekziston — ndoshta lidhja është e vjetër ose dizajni është fshirë.</p>
        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap", justifyContent: "center" }}>
          <a className="btn primary big" href="/">← Kthehu në ballinë</a>
          <a className="btn big" href="/#designs">Shiko dizajnet</a>
        </div>
      </div>
    </main>
  );
}
