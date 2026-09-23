import { get, put, del } from "@vercel/blob";

export type Design = {
  id:string;
  title:string;
  price:string;
  description:string;
  category:"Makina"|"Motoçikleta"|"Të dyja";
  image:string;
  createdAt:string;
  visible:boolean;
};

const DATA_PATH="data/designs.json";

const defaults:Design[]=[
  {id:"demo-1",title:"Design #01",price:"Na kontakto",description:"Shembull dizajni — zëvendësoje nga paneli admin.",category:"Makina",image:"",createdAt:new Date(0).toISOString(),visible:true},
  {id:"demo-2",title:"Design #02",price:"Na kontakto",description:"Shembull dizajni — zëvendësoje nga paneli admin.",category:"Motoçikleta",image:"",createdAt:new Date(0).toISOString(),visible:true},
  {id:"demo-3",title:"Design #03",price:"Na kontakto",description:"Shembull dizajni — zëvendësoje nga paneli admin.",category:"Të dyja",image:"",createdAt:new Date(0).toISOString(),visible:true}
];

export async function readDesigns():Promise<Design[]>{
  try{
    const result=await get(DATA_PATH,{access:"private",useCache:false});
    if(!result) return defaults;
    const text=await new Response(result.stream).text();
    const data=JSON.parse(text);
    return Array.isArray(data)?data:defaults;
  }catch{return defaults;}
}

export async function writeDesigns(data:Design[]){
  await put(DATA_PATH,JSON.stringify(data,null,2),{access:"private",allowOverwrite:true});
}

export async function removeImage(url:string){
  if(!url) return;
  try{await del(url);}catch{}
}
