import { cookies } from "next/headers";

const COOKIE = "folje_admin";
const TTL = 1000 * 60 * 60 * 12;

async function sign(value:string){
  const secret = process.env.ADMIN_PASSWORD;
  if(!secret) throw new Error("ADMIN_PASSWORD is not configured");
  const key = await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig = await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
  return Buffer.from(sig).toString("base64url");
}

async function validToken(token:string){
  const [ts,sig] = token.split(".");
  const time=Number(ts);
  if(!ts || !sig || !Number.isFinite(time) || Date.now()-time>TTL || Date.now()<time) return false;
  const expected=await sign(ts);
  return sig===expected;
}

export async function isAdmin(){
  const token=(await cookies()).get(COOKIE)?.value;
  return !!token && await validToken(token);
}

export async function login(password:string){
  if(!process.env.ADMIN_PASSWORD || password!==process.env.ADMIN_PASSWORD) return false;
  const ts=String(Date.now());
  const token=ts+"."+await sign(ts);
  (await cookies()).set(COOKIE,token,{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:60*60*12});
  return true;
}

export async function logout(){
  (await cookies()).set(COOKIE,"",{httpOnly:true,secure:true,sameSite:"lax",path:"/",maxAge:0});
}
