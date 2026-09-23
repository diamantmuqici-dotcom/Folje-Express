import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "FOLJE EXPRESS — Automotive Foil Design",
  description: "Folie me ngjyra dhe dizajne për makina dhe motoçikleta.",
  metadataBase: new URL("https://folje-express.vercel.app")
};

export default function RootLayout({children}:{children:ReactNode}){
  return <html lang="sq"><body>{children}</body></html>;
}
