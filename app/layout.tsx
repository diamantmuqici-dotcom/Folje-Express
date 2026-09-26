import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { readSettings } from "@/lib/store";
import "./globals.css";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://folje-express.vercel.app";

const KEYWORDS = [
  "folje",
  "folje express",
  "foljeexpress",
  "folje express kosovo",
  "folje për makina",
  "folje makinash",
  "folje veturash",
  "folje motoçikleta",
  "ndërrim ngjyre makine",
  "car wrap",
  "car wrapping",
  "vinyl wrap",
  "vehicle wrap",
  "folie makine",
  "wrap studio",
  "ngjyra makinash",
  "dizajne makinash",
  "paint protection film",
  "ppf",
  "chrome wrap",
  "satin wrap",
  "matte wrap",
  "folje Prishtinë",
  "folje Kosovë",
];

export async function generateMetadata(): Promise<Metadata> {
  const s = await readSettings();
  const title = `${s.businessName} — Folje për Makina & Motoçikleta | Car Wrap Studio`;
  const description = `${s.businessName} (FoljeExpress) — studio premium për folje makinash dhe motoçikletash: ndërrim ngjyre, dizajne custom, PPF mbrojtëse. ${s.tagline}. Shiko dizajnet, çmimet dhe porosit online.`;
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s · ${s.businessName}` },
    description,
    keywords: KEYWORDS,
    applicationName: s.businessName,
    authors: [{ name: s.businessName, url: SITE_URL }],
    creator: s.businessName,
    publisher: s.businessName,
    category: "automotive",
    alternates: { canonical: "/" },
    openGraph: {
      type: "website",
      siteName: s.businessName,
      title: `${s.businessName} — Folje Express | Car Wrap Studio`,
      description,
      url: SITE_URL,
      locale: "sq_AL",
      images: [{ url: "/logo.png", width: 512, height: 512, alt: s.businessName }],
    },
    twitter: {
      card: "summary",
      title: `${s.businessName} — Folje Express`,
      description,
      images: ["/logo.png"],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
    },
    icons: { icon: "/logo.png", apple: "/logo.png", shortcut: "/logo.png" },
    manifest: "/manifest.webmanifest",
  };
}

export const viewport: Viewport = {
  themeColor: "#05070d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const s = await readSettings();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoBusiness",
    name: s.businessName,
    alternateName: ["Folje Express", "FoljeExpress", "folje"],
    description: `Studio për folje makinash dhe motoçikletash — ${s.tagline}.`,
    url: SITE_URL,
    image: `${SITE_URL}/logo.png`,
    logo: `${SITE_URL}/logo.png`,
    telephone: s.phone,
    email: s.email,
    address: { "@type": "PostalAddress", addressLocality: s.address, addressCountry: "XK" },
    openingHours: "Mo-Sa 09:00-19:00",
    priceRange: "€€",
    areaServed: { "@type": "Country", name: "Kosovë" },
    sameAs: [
      s.instagram ? `https://instagram.com/${s.instagram.replace(/^@/, "")}` : "",
      s.tiktok ? `https://tiktok.com/@${s.tiktok.replace(/^@/, "")}` : "",
    ].filter(Boolean),
    knowsAbout: ["folje makinash", "car wrap", "vinyl wrap", "ndërrim ngjyre", "paint protection film"],
  };

  return (
    <html lang="sq">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
