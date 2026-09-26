"use client";

import { useEffect, useRef, useState } from "react";
import { translate, type Lang } from "@/lib/i18n";

type Finish = {
  id: string;
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  clearcoat: number;
};

const FINISHES: Finish[] = [
  { id: "gloss-black", label: "Gloss Black", color: "#0c0d10", metalness: 0.35, roughness: 0.08, clearcoat: 1 },
  { id: "matte-grey", label: "Matte Grey", color: "#5a5f68", metalness: 0.2, roughness: 0.72, clearcoat: 0.1 },
  { id: "satin-red", label: "Satin Race Red", color: "#c8102e", metalness: 0.35, roughness: 0.42, clearcoat: 0.6 },
  { id: "chrome-blue", label: "Chrome Electric", color: "#3aa0ff", metalness: 1, roughness: 0.05, clearcoat: 1 },
  { id: "flip-purple", label: "Flip Violet", color: "#7b2ff7", metalness: 0.9, roughness: 0.15, clearcoat: 1 },
  { id: "gold", label: "Brushed Gold", color: "#d4a537", metalness: 1, roughness: 0.3, clearcoat: 0.5 },
  { id: "green", label: "British Green", color: "#0f5132", metalness: 0.4, roughness: 0.25, clearcoat: 1 },
  { id: "pearl-white", label: "Pearl White", color: "#f2f0ea", metalness: 0.3, roughness: 0.12, clearcoat: 1 },
];

/**
 * ColorLab — 3D wrap visualizer. A curved "car body" panel rendered with a
 * physical car-paint material; visitors pick a foil finish and watch the
 * material update live. Built with three.js only (no extra deps).
 */
export default function ColorLab({ lang = "sq" }: { lang?: Lang }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const materialRef = useRef<{ set(f: Finish): void; spin(): void } | null>(null);
  const [active, setActive] = useState<Finish>(FINISHES[0]);
  const [ready, setReady] = useState(false);
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    import("three").then(async (THREE) => {
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 0.35, 5.1);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      host.appendChild(renderer.domElement);

      const setSize = () => {
        const w = Math.max(host.clientWidth, 1);
        const h = Math.max(host.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      setSize();

      const pmrem = new THREE.PMREMGenerator(renderer);
      let envDispose = () => {};
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (disposed) return;
      const envScene = new RoomEnvironment();
      const envMap = pmrem.fromScene(envScene, 0.04).texture;
      scene.environment = envMap;
      envDispose = () => {
        envMap.dispose();
        pmrem.dispose();
      };

      /* curved body panel — like a car fender */
      const bodyGeo = new THREE.SphereGeometry(2.6, 96, 96, -Math.PI / 3.1, Math.PI / 1.55, Math.PI / 3.4, Math.PI / 2.6);
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(FINISHES[0].color),
        metalness: FINISHES[0].metalness,
        roughness: FINISHES[0].roughness,
        clearcoat: FINISHES[0].clearcoat,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.5,
        side: THREE.DoubleSide,
      });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.rotation.z = 0.12;
      scene.add(body);

      /* accent stripe (design detail) */
      const stripeGeo = new THREE.TorusGeometry(2.62, 0.02, 8, 120, Math.PI / 1.7);
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.rotation.set(Math.PI / 2 - 0.42, 0, 0);
      stripe.rotation.z = 0.12;
      stripe.rotation.y = Math.PI / 2.2;
      scene.add(stripe);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0d14, 0.8));
      const key = new THREE.DirectionalLight(0xffffff, 2.4);
      key.position.set(2.5, 3.5, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0x5bc7ff, 14, 8);
      rim.position.set(-3, 0.5, 1.5);
      scene.add(rim);

      let spinBoost = 0;
      materialRef.current = {
        set(f: Finish) {
          bodyMat.color.set(f.color);
          bodyMat.metalness = f.metalness;
          bodyMat.roughness = f.roughness;
          bodyMat.clearcoat = f.clearcoat;
          bodyMat.needsUpdate = true;
        },
        spin() {
          spinBoost = 3.4;
        },
      };

      const onResize = () => setSize();
      window.addEventListener("resize", onResize);

      /* drag to rotate */
      let dragging = false;
      let lastX = 0;
      let velocity = 0;
      const down = (e: PointerEvent) => {
        dragging = true;
        lastX = e.clientX;
      };
      const move = (e: PointerEvent) => {
        if (!dragging) return;
        velocity = (e.clientX - lastX) * 0.005;
        body.rotation.y += velocity;
        stripe.rotation.y += velocity;
        lastX = e.clientX;
      };
      const up = () => {
        dragging = false;
      };
      renderer.domElement.addEventListener("pointerdown", down);
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);

      let raf = 0;
      let last = performance.now();
      const tick = () => {
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (!dragging) {
          const speed = 0.18 + spinBoost;
          body.rotation.y += dt * speed + velocity * 0.92;
          stripe.rotation.y += dt * speed + velocity * 0.92;
          velocity *= 0.92;
          spinBoost *= 0.94;
          if (spinBoost < 0.01) spinBoost = 0;
        }
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      setReady(true);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        renderer.domElement.removeEventListener("pointerdown", down);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        bodyGeo.dispose();
        bodyMat.dispose();
        stripeGeo.dispose();
        stripeMat.dispose();
        envDispose();
        renderer.dispose();
        renderer.domElement.remove();
        materialRef.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  const pick = (f: Finish) => {
    setActive(f);
    materialRef.current?.set(f);
    materialRef.current?.spin();
  };

  return (
    <div className="colorlab">
      <div className="colorlab-stage">
        <div className="colorlab-canvas" ref={hostRef} />
        {!ready && <div className="colorlab-loading">{t("lab.loading")}</div>}
        <div className="colorlab-hint">{t("lab.hint")}</div>
      </div>
      <div className="colorlab-panel">
        <span className="eyebrow">{t("lab.choose")}</span>
        <h3>
          {active.label} <em>{t("lab.live")}</em>
        </h3>
        <p>{t("lab.desc", { finish: active.label })}</p>
        <div className="swatches" role="radiogroup" aria-label={t("lab.choose")}>
          {FINISHES.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={active.id === f.id}
              className={"swatch " + (active.id === f.id ? "active" : "")}
              style={{ background: f.color }}
              title={f.label}
              onClick={() => pick(f)}
            >
              <span>{f.label}</span>
            </button>
          ))}
        </div>
        <a className="btn primary" href="#contact">
          {t("lab.cta", { finish: active.label })}
        </a>
      </div>
    </div>
  );
}
