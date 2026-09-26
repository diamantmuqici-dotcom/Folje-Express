import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FOLJE EXPRESS — Folje për Motoçikleta",
    short_name: "FoljeExpress",
    description:
      "Folje premium, ndërrim ngjyre dhe dizajne custom për motoçikleta. Folje Express — motorcycle wrap studio.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070d",
    theme_color: "#05070d",
    lang: "sq",
    categories: ["business", "shopping"],
    icons: [
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}
