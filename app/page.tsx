import {readDesigns} from "@/lib/store";
import HomeClient from "./home-client";

export const dynamic="force-dynamic";

export default async function Page(){
  const designs=(await readDesigns()).filter(d=>d.visible);
  return <HomeClient initialDesigns={designs}/>;
}
