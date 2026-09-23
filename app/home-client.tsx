"use client";

import {useEffect,useMemo,useState} from "react";
import type {Design} from "@/lib/store";

const LOGO="https://raw.githubusercontent.com/diamantmuqici-dotcom/Folje-Express/main/logo.png";

function Foil3D(){
  useEffect(()=>{
    let cleanup=()=>{};
    import("three").then(THREE=>{
      const host=document.getElementById("foil3d");
      if(!host) return;
      const scene=new THREE.Scene();
      const camera=new THREE.PerspectiveCamera(35,1,.1,100);
      camera.position.set(0,0,5.4);
      const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
      renderer.setSize(host.clientWidth,host.clientHeight,false);
      renderer.outputColorSpace=THREE.SRGBColorSpace;
      host.appendChild(renderer.domElement);
      const group=new THREE.Group();
      scene.add(group);
      const geo=new THREE.TorusKnotGeometry(1.42,.43,220,32,2,3);
      const mat=new THREE.MeshPhysicalMaterial({color:0x252525,metalness:.72,roughness:.2,clearcoat:1,clearcoatRoughness:.08});
      const mesh=new THREE.Mesh(geo,mat);
      group.add(mesh);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(1.82,.018,12,160),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.38}));
      group.add(ring);
      scene.add(new THREE.HemisphereLight(0xffffff,0x111111,2.2));
      const key=new THREE.DirectionalLight(0xffffff,5); key.position.set(3,4,5); scene.add(key);
      const cyan=new THREE.PointLight(0x5bc7ff,22,8); cyan.position.set(-3,1,2); scene.add(cyan);
      const magenta=new THREE.PointLight(0xff315b,16,8); magenta.position.set(3,-2,1); scene.add(magenta);
      const resize=()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)};
      window.addEventListener("resize",resize);
      let raf=0;
      const tick=()=>{const t=performance.now()/1000;mesh.rotation.x=t*.16;mesh.rotation.y=t*.3;ring.rotation.z=-t*.11;renderer.render(scene,camera);raf=requestAnimationFrame(tick)};
      tick();
      cleanup=()=>{cancelAnimationFrame(raf);window.removeEventListener("resize",resize);geo.dispose();mat.dispose();renderer.dispose();renderer.domElement.remove()};
    });
    return ()=>cleanup();
  },[]);
  return <div id="foil3d" aria-label="3D preview"/>;
}

function DesignCard({d}:{d:Design}){
  return <article className="design-card">
    <div className="design-image">
      {d.image ? <img src={d.image} alt={d.title} loading="lazy"/> : <div className={"foil-swatch "+(d.id==="demo-1"?"red":d.id==="demo-2"?"blue":"purple")}/>}
      <span className="category">{d.category}</span>
    </div>
    <div className="design-body"><div className="design-number">FOLJE EXPRESS</div><h3>{d.title}</h3><p>{d.description}</p><strong>{d.price}</strong></div>
  </article>;
}

export default function HomeClient({initialDesigns}:{initialDesigns:Design[]}){
  const [menu,setMenu]=useState(false);
  const [filter,setFilter]=useState("Të gjitha");
  const designs=useMemo(()=>filter==="Të gjitha"?initialDesigns:initialDesigns.filter(d=>d.category===filter),[initialDesigns,filter]);
  return <main>
    <header className="nav">
      <a className="brand" href="#home"><img src={LOGO} alt="FOLJE EXPRESS"/></a>
      <button className="menu" onClick={()=>setMenu(!menu)} aria-label="Hap menunë">☰</button>
      <nav className={menu?"open":""}>{["home","designs","process","contact"].map((id,i)=><a key={id} href={"#"+id} onClick={()=>setMenu(false)}>{["Ballina","Dizajnet","Procesi","Kontakt"][i]}</a>)}</nav>
      <a className="admin-link" href="/admin">ADMIN</a>
    </header>

    <section id="home" className="hero">
      <div className="hero-copy">
        <span className="eyebrow">FOLJE EXPRESS / AUTOMOTIVE DESIGN</span>
        <h1>Ndrysho<br/><em>pamjen.</em></h1>
        <p>Folie me ngjyra dhe dizajne për makina dhe motoçikleta. Një pamje e re, e ndërtuar rreth stilit tënd.</p>
        <div className="actions"><a className="btn primary" href="#designs">Shiko dizajnet <span>↗</span></a><a className="btn" href="#contact">Na kontakto</a></div>
        <div className="trust"><span>01</span> DESIGN <i/> <span>02</span> FOIL <i/> <span>03</span> FINISH</div>
      </div>
      <div className="hero-stage"><div className="stage-grid"/><Foil3D/><div className="stage-label"><b>3D</b> FOLJE EXPRESS</div><div className="stage-orbit">INTERACTIVE / 360°</div></div>
    </section>

    <section id="designs" className="section designs">
      <div className="section-head"><div><span className="eyebrow">DESIGN LIBRARY</span><h2>Dizajnet <em>tona.</em></h2></div><p>Shiko dizajnet e publikuara. Çmimet, fotot dhe përshkrimet mund të menaxhohen nga paneli privat.</p></div>
      <div className="filters">{["Të gjitha","Makina","Motoçikleta","Të dyja"].map(x=><button className={filter===x?"active":""} key={x} onClick={()=>setFilter(x)}>{x}</button>)}</div>
      <div className="design-grid">{designs.length?designs.map(d=><DesignCard key={d.id} d={d}/>):<div className="empty">Nuk ka dizajne në këtë kategori.</div>}</div>
    </section>

    <section id="process" className="section process">
      <div className="section-head"><span className="eyebrow">SI FUNKSIONON</span><h2>Ngjyra. Dizajn.<br/><em>Aplikim.</em></h2></div>
      <div className="steps"><div><b>01</b><h3>Zgjedh stilin</h3><p>Shfleto dizajnet dhe zgjidh ngjyrën ose pamjen që të përshtatet.</p></div><div><b>02</b><h3>Përgatitja</h3><p>Folia dhe dizajni përgatiten me kujdes për automjetin tënd.</p></div><div><b>03</b><h3>Aplikimi</h3><p>Folia aplikohet pastër dhe me fokus te detajet e përfundimit.</p></div></div>
    </section>

    <section id="contact" className="contact-section">
      <div><span className="eyebrow">FOLJE EXPRESS / KONTAKT</span><h2>Gati për një<br/><em>pamje tjetër?</em></h2><p>Na kontakto për dizajnin, ngjyrën dhe çmimin.</p></div>
      <div className="contact-actions"><a className="btn primary big" href="tel:+383">Na telefono <span>↗</span></a><a className="btn big" href="#designs">Shiko dizajnet</a></div>
    </section>

    <footer><img src={LOGO} alt="FOLJE EXPRESS"/><span>© {new Date().getFullYear()} FOLJE EXPRESS</span><a href="#home">Lart ↑</a></footer>
  </main>;
}
