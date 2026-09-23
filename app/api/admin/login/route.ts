import { login } from "@/lib/auth";
export async function POST(request:Request){
  const {password}=await request.json().catch(()=>({}));
  if(typeof password!=="string" || !(await login(password))) return Response.json({error:"Fjalëkalimi nuk është i saktë."},{status:401});
  return Response.json({ok:true});
}
