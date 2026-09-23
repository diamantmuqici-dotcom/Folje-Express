import { readDesigns } from "@/lib/store";
export const dynamic="force-dynamic";
export async function GET(){
  const designs=(await readDesigns()).filter(d=>d.visible);
  return Response.json(designs,{headers:{"Cache-Control":"no-store"}});
}
