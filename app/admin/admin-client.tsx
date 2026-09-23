"use client";
import {useEffect,useState} from "react";
import type {FormEvent} from "react";
import type {Design} from "@/lib/store";

const LOGO="/logo.png";

export default function AdminClient(){
  const [logged,setLogged]=useState(false),[password,setPassword]=useState(""),[items,setItems]=useState<Design[]>([]),[loading,setLoading]=useState(false),[message,setMessage]=useState("");
  const [form,setForm]=useState({title:"",price:"",description:"",category:"Të dyja",image:null as File|null});

  async function load(isPrivate=logged){
    const r=await fetch(isPrivate?"/api/admin/designs":"/api/designs",{cache:"no-store"});
    if(r.ok)setItems(await r.json());
  }
  useEffect(()=>{load(false)},[]);

  async function login(e:FormEvent){
    e.preventDefault();setLoading(true);
    const r=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password})});
    setLoading(false);
    if(r.ok){setLogged(true);setMessage("U kyçe me sukses.");await load(true)}
    else setMessage("Fjalëkalimi nuk është i saktë.");
  }
  async function upload(e:FormEvent){
    e.preventDefault();
    if(!form.image){setMessage("Zgjidh një foto.");return}
    setLoading(true);
    const fd=new FormData();
    fd.append("title",form.title);fd.append("price",form.price);fd.append("description",form.description);fd.append("category",form.category);fd.append("image",form.image);
    const r=await fetch("/api/admin/designs",{method:"POST",body:fd});const data=await r.json();setLoading(false);
    if(!r.ok){setMessage(data.error||"Gabim gjatë upload-it.");return}
    setMessage("Dizajni u publikua.");setForm({title:"",price:"",description:"",category:"Të dyja",image:null});await load(true);
  }
  async function remove(id:string){
    if(!confirm("A dëshiron ta fshish këtë dizajn?"))return;
    const r=await fetch("/api/admin/designs",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    if(r.ok){setMessage("Dizajni u fshi.");await load(true)}else setMessage("Nuk u fshi.");
  }
  async function toggle(d:Design){
    const r=await fetch("/api/admin/designs",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:d.id,visible:!d.visible})});
    if(r.ok)await load(true);
  }
  async function logout(){await fetch("/api/admin/logout",{method:"POST"});setLogged(false);await load(false);}

  if(!logged)return <main className="admin-shell"><div className="admin-login"><img src={LOGO} alt="FOLJE EXPRESS"/><span className="eyebrow">PRIVATE ADMIN</span><h1>Paneli yt.</h1><p>Ky panel është vetëm për menaxhimin e dizajneve të FOLJE EXPRESS.</p><form onSubmit={login}><input type="password" placeholder="Fjalëkalimi" value={password} onChange={e=>setPassword(e.target.value)} autoFocus/><button className="btn primary" disabled={loading}>{loading?"Duke hyrë...":"Hyr në panel"}</button></form>{message&&<small>{message}</small>}<a href="/">← Kthehu në website</a></div></main>;

  const realItems=items.filter(x=>!x.id.startsWith("demo-"));
  return <main className="admin-shell"><header className="admin-top"><img src={LOGO} alt="FOLJE EXPRESS"/><div><a href="/">Website ↗</a><button onClick={logout}>Dil</button></div></header><section className="admin-content"><div className="admin-title"><div><span className="eyebrow">CONTENT MANAGEMENT</span><h1>Designs.</h1></div><span>{realItems.length} dizajne</span></div><form className="upload-card" onSubmit={upload}><div className="upload-copy"><span className="eyebrow">NEW DESIGN</span><h2>Publiko një dizajn.</h2><p>Ngarko foton dhe vendos çmimin/përshkrimin. Dizajni del automatikisht në website.</p></div><div className="form-grid"><input required placeholder="Titulli" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><input placeholder="Çmimi, p.sh. 120€" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}><option>Makina</option><option>Motoçikleta</option><option>Të dyja</option></select><input required type="file" accept="image/*" onChange={e=>setForm({...form,image:e.target.files?.[0]||null})}/><textarea placeholder="Përshkrimi" value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/><button className="btn primary" disabled={loading}>{loading?"Duke ruajtur...":"Publiko dizajnin"}</button></div></form>{message&&<div className="admin-message">{message}</div>}<div className="admin-list">{realItems.map(d=><article key={d.id} className="admin-item"><img src={d.image} alt=""/><div><span>{d.category} · {d.visible?"PUBLIK":"I FSHEHUR"}</span><h3>{d.title}</h3><p>{d.price} · {d.description}</p></div><div className="admin-actions"><button onClick={()=>toggle(d)}>{d.visible?"Fshih":"Publiko"}</button><button className="danger" onClick={()=>remove(d.id)}>Fshi</button></div></article>)}{realItems.length===0&&<div className="empty admin-empty">Ende nuk ke publikuar dizajne.</div>}</div></section></main>;
}
