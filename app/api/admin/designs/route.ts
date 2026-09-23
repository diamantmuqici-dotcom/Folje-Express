import { isAdmin } from "@/lib/auth";
import { readDesigns,writeDesigns,removeImage,Design } from "@/lib/store";
import { put } from "@vercel/blob";

export const runtime="nodejs";

function clean(v:FormDataEntryValue|null,max=1000){return typeof v==="string"?v.trim().slice(0,max):"";}

export async function POST(request:Request){
  if(!(await isAdmin())) return Response.json({error:"Nuk je i autorizuar."},{status:401});
  const form=await request.formData();
  const file=form.get("image");
  if(!(file instanceof File) || !file.type.startsWith("image/")) return Response.json({error:"Ngarko një foto."},{status:400});
  if(file.size>12*1024*1024) return Response.json({error:"Fotoja duhet të jetë nën 12MB."},{status:400});
  const title=clean(form.get("title"),80)||"Pa titull";
  const price=clean(form.get("price"),60)||"Na kontakto";
  const description=clean(form.get("description"),500);
  const raw=clean(form.get("category"),30);
  const category=(["Makina","Motoçikleta","Të dyja"].includes(raw)?raw:"Të dyja") as Design["category"];
  const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase()||"jpg";
  const blob=await put("designs/"+crypto.randomUUID()+"."+ext,file,{access:"public",addRandomSuffix:false});
  const design:Design={id:crypto.randomUUID(),title,price,description,category,image:blob.url,createdAt:new Date().toISOString(),visible:true};
  const data=(await readDesigns()).filter(d=>!d.id.startsWith("demo-"));
  data.unshift(design);
  await writeDesigns(data);
  return Response.json(design);
}

export async function PATCH(request:Request){
  if(!(await isAdmin())) return Response.json({error:"Nuk je i autorizuar."},{status:401});
  const body=await request.json();
  const data=await readDesigns();
  const item=data.find(d=>d.id===body.id);
  if(!item) return Response.json({error:"Dizajni nuk u gjet."},{status:404});
  item.title=String(body.title??item.title).slice(0,80);
  item.price=String(body.price??item.price).slice(0,60);
  item.description=String(body.description??item.description).slice(0,500);
  if(["Makina","Motoçikleta","Të dyja"].includes(body.category)) item.category=body.category;
  if(typeof body.visible==="boolean") item.visible=body.visible;
  await writeDesigns(data);
  return Response.json(item);
}

export async function DELETE(request:Request){
  if(!(await isAdmin())) return Response.json({error:"Nuk je i autorizuar."},{status:401});
  const {id}=await request.json();
  const data=await readDesigns();
  const item=data.find(d=>d.id===id);
  if(!item) return Response.json({error:"Dizajni nuk u gjet."},{status:404});
  await removeImage(item.image);
  await writeDesigns(data.filter(d=>d.id!==id));
  return Response.json({ok:true});
}
