import { readDesigns, readSettings } from "@/lib/store";
import HomeClient from "./home-client";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [designs, settings] = await Promise.all([readDesigns(), readSettings()]);
  const visible = designs
    .filter((d) => d.visible)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order);
  return <HomeClient initialDesigns={visible} settings={settings} />;
}
