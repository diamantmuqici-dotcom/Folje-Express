import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
const el=document.querySelector("#foil3d"), menu=document.querySelector(".menu"), nav=document.querySelector(".nav nav");
menu?.addEventListener("click",()=>nav?.classList.toggle("open"));
document.querySelector("#year").textContent=new Date().getFullYear();

if(el){
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(38,1,.1,100);
 camera.position.set(0.1,0.2,5.8);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.outputColorSpace=THREE.SRGBColorSpace; el.appendChild(renderer.domElement);
 const group=new THREE.Group(); scene.add(group);
 const geo=new THREE.TorusKnotGeometry(1.45,.48,220,36,2,3);
 const mat=new THREE.MeshPhysicalMaterial({color:0x202020,metalness:.18,roughness:.23,clearcoat:1,clearcoatRoughness:.12});
 const obj=new THREE.Mesh(geo,mat); group.add(obj);
 const ringGeo=new THREE.TorusGeometry(1.75,.025,16,160);
 const ring=new THREE.Mesh(ringGeo,new THREE.MeshBasicMaterial({color:0x8c8c8c,transparent:true,opacity:.45})); group.add(ring);
 const light=new THREE.DirectionalLight(0xffffff,4); light.position.set(3,4,5); scene.add(light);
 const fill=new THREE.PointLight(0x6688ff,18,8); fill.position.set(-3,1,2); scene.add(fill);
 const rim=new THREE.PointLight(0xff2244,12,7); rim.position.set(3,-2,-1); scene.add(rim);
 const resize=()=>{const r=el.getBoundingClientRect();camera.aspect=r.width/r.height;camera.updateProjectionMatrix();renderer.setSize(r.width,r.height,false)}; addEventListener("resize",resize); resize();
 const clock=new THREE.Clock();
 const animate=()=>{const t=clock.getElapsedTime();obj.rotation.x=t*.18;obj.rotation.y=t*.32;ring.rotation.z=-t*.12;renderer.render(scene,camera);requestAnimationFrame(animate)}; animate();
}