"use client";

import { useEffect, useRef, useState } from "react";
import type { Group, Material, Mesh, Texture } from "three";
import { translate, type Lang } from "@/lib/i18n";
import type { Design, SiteSettings } from "@/lib/store";

/* ------------------------------------------------------------------ */
/* Catalogue                                                           */
/* ------------------------------------------------------------------ */

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

type ModelDef = {
  id: string;
  name: string;
  type: "gas" | "electric";
  style: "scooter" | "sport" | "classic";
};

const MODELS: ModelDef[] = [
  { id: "nmax", name: "Yamaha NMAX", type: "gas", style: "scooter" },
  { id: "niu", name: "NIU NQi", type: "electric", style: "scooter" },
  { id: "aerox", name: "Yamaha Aerox", type: "gas", style: "sport" },
  { id: "surron", name: "Sur-Ron Light Bee", type: "electric", style: "sport" },
  { id: "vespa", name: "Vespa Primavera", type: "gas", style: "classic" },
];

type WrapChoice = { kind: "finish"; id: string } | { kind: "design"; id: string };

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

/**
 * ColorLab — 3D motorcycle configurator.
 *  1. pick a model (gas / electric, scooter / sport / classic silhouettes)
 *  2. pick a wrap: our premium finishes OR the real wraps published on the
 *     website (their photos are applied as live textures on the 3D body)
 * Built with three.js primitives only — stylised "designer toy" look.
 */
export default function ColorLab({ lang = "sq", settings }: { lang?: Lang; settings: SiteSettings }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const api = useRef<{
    setModel(m: ModelDef): void;
    setFinish(f: Finish): void;
    setTexture(url: string | null): void;
    spin(): void;
  } | null>(null);

  const [model, setModel] = useState<ModelDef>(MODELS[0]);
  const [finish, setFinish] = useState<Finish>(FINISHES[0]);
  const [choice, setChoice] = useState<WrapChoice>({ kind: "finish", id: FINISHES[0].id });
  const [siteWraps, setSiteWraps] = useState<Design[]>([]);
  const [ready, setReady] = useState(false);
  const t = (k: string, v?: Record<string, string | number>) => translate(lang, k, v);

  /* published wraps with photos become testable textures */
  useEffect(() => {
    fetch("/api/designs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d: Design[]) => setSiteWraps(d.filter((x) => x.image)))
      .catch(() => {});
  }, []);

  /* ------------------------------------------------------------ three */
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let cleanup = () => {};

    import("three").then(async (THREE) => {
      if (disposed) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
      camera.position.set(0, 1.15, 4.7);

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
      const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envMap;
      envDispose = () => envMap.dispose();

      /* shared materials */
      const wrapMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(FINISHES[0].color),
        metalness: FINISHES[0].metalness,
        roughness: FINISHES[0].roughness,
        clearcoat: FINISHES[0].clearcoat,
        clearcoatRoughness: 0.1,
        envMapIntensity: 1.35,
      });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 0.92 });
      const rimMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b0, metalness: 0.95, roughness: 0.22 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x161a21, roughness: 0.55 });
      const seatMat = new THREE.MeshStandardMaterial({ color: 0x0e1013, roughness: 0.8 });
      const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.08 });
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.28, roughness: 0.1 });

      /* texture cache for website wraps */
      const loader = new THREE.TextureLoader();
      const texCache = new Map<string, Texture>();

      /* ------------------------------------------------ bike builder */
      type V3 = [number, number, number];
      const ell = (r: number, s: V3, p: V3, mat: Material, rot: V3 = [0, 0, 0]) => {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), mat);
        m.scale.set(s[0], s[1], s[2]);
        m.position.set(p[0], p[1], p[2]);
        m.rotation.set(rot[0], rot[1], rot[2]);
        return m;
      };
      const box = (s: V3, p: V3, mat: Material, rot: V3 = [0, 0, 0]) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(s[0], s[1], s[2]), mat);
        m.position.set(p[0], p[1], p[2]);
        m.rotation.set(rot[0], rot[1], rot[2]);
        return m;
      };
      const cyl = (rt: number, rb: number, h: number, p: V3, mat: Material, rot: V3 = [0, 0, 0]) => {
        const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 20), mat);
        m.position.set(p[0], p[1], p[2]);
        m.rotation.set(rot[0], rot[1], rot[2]);
        return m;
      };
      const wheel = (r: number, x: number) => {
        const g = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.TorusGeometry(r, r * 0.3, 18, 40), tireMat);
        g.add(tire);
        const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, r * 0.2, 24), rimMat);
        rim.rotation.x = Math.PI / 2;
        g.add(rim);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.16, r * 0.16, r * 0.26, 14), darkMat);
        hub.rotation.x = Math.PI / 2;
        g.add(hub);
        for (let i = 0; i < 5; i++) {
          const spoke = box([r * 0.52, r * 0.09, r * 0.06], [0, 0, 0], rimMat);
          spoke.position.set(Math.cos((i / 5) * Math.PI * 2) * r * 0.34, Math.sin((i / 5) * Math.PI * 2) * r * 0.34, 0);
          spoke.rotation.z = (i / 5) * Math.PI * 2;
          g.add(spoke);
        }
        g.position.set(x, r, 0);
        return g;
      };

      function buildBike(def: ModelDef): Group {
        const g = new THREE.Group();
        const { style, type } = def;

        if (style === "scooter") {
          g.add(wheel(0.3, -0.78), wheel(0.3, 0.78));
          g.add(box([0.6, 0.06, 0.34], [0.02, 0.3, 0], darkMat)); // floorboard
          g.add(ell(0.5, [0.5, 0.95, 0.42], [-0.52, 0.78, 0], wrapMat, [0, 0, -0.28])); // front shield
          g.add(ell(0.34, [1.05, 0.5, 0.85], [-0.78, 0.4, 0], wrapMat)); // front fender
          g.add(ell(0.55, [0.72, 0.5, 0.5], [0.6, 0.6, 0], wrapMat)); // rear body
          g.add(box([0.52, 0.12, 0.3], [0.52, 0.98, 0], seatMat)); // seat
          g.add(cyl(0.045, 0.05, 0.62, [-0.66, 1.02, 0], darkMat, [0, 0, 0.32])); // steering column
          g.add(cyl(0.02, 0.02, 0.56, [-0.78, 1.28, 0], chromeMat, [Math.PI / 2, 0, 0])); // handlebar
          g.add(cyl(0.03, 0.03, 0.14, [-0.78, 1.28, 0.32], seatMat, [Math.PI / 2, 0, 0])); // grips
          g.add(cyl(0.03, 0.03, 0.14, [-0.78, 1.28, -0.32], seatMat, [Math.PI / 2, 0, 0]));
          g.add(ell(0.1, [1, 0.8, 0.6], [-0.86, 0.98, 0], glassMat)); // headlight
          g.add(cyl(0.024, 0.024, 0.5, [-0.72, 0.5, 0.12], darkMat, [0, 0, 0.35])); // fork
          g.add(cyl(0.024, 0.024, 0.5, [-0.72, 0.5, -0.12], darkMat, [0, 0, 0.35]));
          // mirrors
          g.add(cyl(0.008, 0.008, 0.22, [-0.74, 1.4, 0.3], darkMat, [0.3, 0, 0]));
          g.add(cyl(0.008, 0.008, 0.22, [-0.74, 1.4, -0.3], darkMat, [-0.3, 0, 0]));
          g.add(ell(0.06, [1, 0.7, 1], [-0.72, 1.5, 0.34], darkMat));
          g.add(ell(0.06, [1, 0.7, 1], [-0.72, 1.5, -0.34], darkMat));
        } else if (style === "sport") {
          g.add(wheel(0.34, -0.85), wheel(0.34, 0.85));
          g.add(ell(0.4, [1.05, 0.62, 0.72], [-0.12, 0.92, 0], wrapMat)); // tank
          g.add(ell(0.42, [0.9, 0.72, 0.28], [-0.34, 0.66, 0.2], wrapMat)); // fairing L
          g.add(ell(0.42, [0.9, 0.72, 0.28], [-0.34, 0.66, -0.2], wrapMat)); // fairing R
          g.add(box([0.5, 0.14, 0.26], [0.72, 1.02, 0], wrapMat, [0, 0, -0.42])); // tail
          g.add(box([0.46, 0.1, 0.26], [0.3, 0.94, 0], seatMat)); // seat
          g.add(box([0.06, 0.34, 0.3], [-0.78, 1.22, 0], glassMat, [0, 0, 0.5])); // windshield
          g.add(cyl(0.02, 0.02, 0.5, [-0.66, 1.0, 0], chromeMat, [Math.PI / 2, 0, 0])); // clip-ons
          g.add(cyl(0.028, 0.028, 0.56, [-0.8, 0.52, 0.1], chromeMat, [0, 0, 0.42])); // forks
          g.add(cyl(0.028, 0.028, 0.56, [-0.8, 0.52, -0.1], chromeMat, [0, 0, 0.42]));
          g.add(ell(0.09, [1, 0.7, 1.2], [-0.92, 0.86, 0], glassMat)); // headlight
        } else {
          /* classic */
          g.add(wheel(0.32, -0.76), wheel(0.32, 0.76));
          g.add(ell(0.5, [0.42, 0.95, 0.62], [-0.5, 0.82, 0], wrapMat, [0, 0, -0.18])); // leg shield
          g.add(ell(0.36, [1.1, 0.55, 0.8], [-0.76, 0.46, 0], wrapMat)); // front fender
          g.add(ell(0.42, [1.05, 0.62, 0.85], [0.76, 0.5, 0], wrapMat)); // rear fender
          g.add(ell(0.4, [0.85, 0.55, 0.6], [0.28, 0.78, 0], wrapMat)); // body
          g.add(box([0.48, 0.12, 0.3], [0.4, 1.02, 0], seatMat)); // seat
          g.add(ell(0.11, [1, 1, 0.8], [-0.62, 1.16, 0], chromeMat)); // round headlight
          g.add(cyl(0.02, 0.02, 0.6, [-0.56, 1.3, 0], chromeMat, [Math.PI / 2, 0, 0])); // bar
          g.add(cyl(0.03, 0.03, 0.14, [-0.56, 1.3, 0.34], seatMat, [Math.PI / 2, 0, 0]));
          g.add(cyl(0.03, 0.03, 0.14, [-0.56, 1.3, -0.34], seatMat, [Math.PI / 2, 0, 0]));
          g.add(cyl(0.024, 0.024, 0.5, [-0.7, 0.52, 0.1], darkMat, [0, 0, 0.3]));
          g.add(cyl(0.024, 0.024, 0.5, [-0.7, 0.52, -0.1], darkMat, [0, 0, 0.3]));
        }

        /* powertrain: exhaust for gas, battery pack for electric */
        if (type === "gas") {
          g.add(cyl(0.05, 0.06, 0.72, [0.5, 0.24, 0.24], chromeMat, [0, 0, Math.PI / 2 - 0.12]));
          g.add(cyl(0.062, 0.062, 0.2, [0.82, 0.28, 0.24], darkMat, [0, 0, Math.PI / 2 - 0.12]));
        } else {
          g.add(box([0.34, 0.22, 0.26], [0.12, 0.42, 0], darkMat));
          g.add(box([0.36, 0.03, 0.27], [0.12, 0.54, 0], rimMat));
        }

        /* contact shadow */
        const shadow = new THREE.Mesh(
          new THREE.CircleGeometry(1.35, 40),
          new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.42 })
        );
        shadow.rotation.x = -Math.PI / 2;
        shadow.position.y = 0.012;
        g.add(shadow);

        g.position.y = -0.35;
        return g;
      }

      let bike = buildBike(MODELS[0]);
      scene.add(bike);

      scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0d14, 0.7));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(2.5, 4, 4);
      scene.add(key);
      const rim = new THREE.PointLight(0x5bc7ff, 12, 9);
      rim.position.set(-3, 1.2, 1.5);
      scene.add(rim);

      let spinBoost = 0;
      let lastFinish = FINISHES[0];

      api.current = {
        setModel(def) {
          scene.remove(bike);
          bike.traverse((o: unknown) => {
            const mesh = o as Mesh;
            if (mesh.geometry) mesh.geometry.dispose();
            const mat = mesh.material as Material | undefined;
            if (mat && mat !== wrapMat && mat !== tireMat && mat !== rimMat && mat !== darkMat && mat !== seatMat && mat !== chromeMat && mat !== glassMat) mat.dispose();
          });
          bike = buildBike(def);
          scene.add(bike);
        },
        setFinish(f) {
          lastFinish = f;
          wrapMat.map = null;
          wrapMat.color.set(f.color);
          wrapMat.metalness = f.metalness;
          wrapMat.roughness = f.roughness;
          wrapMat.clearcoat = f.clearcoat;
          wrapMat.needsUpdate = true;
        },
        setTexture(url) {
          if (!url) {
            api.current?.setFinish(lastFinish);
            return;
          }
          const apply = (tex: Texture) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            wrapMat.map = tex;
            wrapMat.color.set(0xffffff);
            wrapMat.metalness = 0.42;
            wrapMat.roughness = 0.24;
            wrapMat.clearcoat = 1;
            wrapMat.needsUpdate = true;
          };
          const cached = texCache.get(url);
          if (cached) apply(cached);
          else
            loader.load(url, (tex) => {
              texCache.set(url, tex);
              if (!disposed) apply(tex);
            });
        },
        spin() {
          spinBoost = 3.2;
        },
      };

      const onResize = () => setSize();
      window.addEventListener("resize", onResize);

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
        bike.rotation.y += velocity;
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
          const speed = 0.22 + spinBoost;
          bike.rotation.y += dt * speed + velocity * 0.92;
          velocity *= 0.92;
          spinBoost *= 0.94;
          if (spinBoost < 0.01) spinBoost = 0;
        }
        camera.lookAt(0, 0.62, 0);
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
        texCache.forEach((tex) => tex.dispose());
        wrapMat.dispose();
        tireMat.dispose();
        rimMat.dispose();
        darkMat.dispose();
        seatMat.dispose();
        chromeMat.dispose();
        glassMat.dispose();
        envDispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
        api.current = null;
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  /* ------------------------------------------------------------ ui */
  const pickModel = (m: ModelDef) => {
    setModel(m);
    api.current?.setModel(m);
    api.current?.spin();
  };
  const pickFinish = (f: Finish) => {
    setFinish(f);
    setChoice({ kind: "finish", id: f.id });
    api.current?.setFinish(f);
    api.current?.spin();
  };
  const pickDesign = (d: Design) => {
    setChoice({ kind: "design", id: d.id });
    api.current?.setTexture(d.image);
    api.current?.spin();
  };

  const wrapLabel = choice.kind === "finish" ? finish.label : siteWraps.find((w) => w.id === choice.id)?.title || "Custom";
  const waNum = settings.whatsapp.replace(/[^0-9]/g, "");
  const waMsg =
    lang === "en"
      ? `Hello ${settings.businessName}! I want a quote: ${model.name} (${model.type === "electric" ? "electric" : "gas"}) wrapped in "${wrapLabel}".`
      : lang === "de"
        ? `Hallo ${settings.businessName}! Ich möchte ein Angebot: ${model.name} (${model.type === "electric" ? "Elektro" : "Benzin"}) in "${wrapLabel}".`
        : `Përshëndetje ${settings.businessName}! Dua një ofertë: ${model.name} (${model.type === "electric" ? "elektrik" : "benzinë"}) me wrap "${wrapLabel}".`;

  return (
    <div className="colorlab">
      <div className="colorlab-stage">
        <div className="colorlab-canvas" ref={hostRef} />
        {!ready && <div className="colorlab-loading">{t("lab.loading")}</div>}
        <div className="colorlab-hint">{t("lab.hint")}</div>
        <div className="colorlab-model-tag">
          {model.name} · {model.type === "electric" ? t("lab.typeElectric") : t("lab.typeGas")}
        </div>
      </div>
      <div className="colorlab-panel">
        <span className="eyebrow">{t("lab.stepModel")}</span>
        <div className="model-chips">
          {MODELS.map((m) => (
            <button key={m.id} className={"model-chip " + (model.id === m.id ? "active" : "")} onClick={() => pickModel(m)}>
              <b>{m.name}</b>
              <span className={"type-tag " + m.type}>{m.type === "electric" ? t("lab.typeElectric") : t("lab.typeGas")}</span>
            </button>
          ))}
        </div>

        <span className="eyebrow">{t("lab.stepWrap")}</span>
        {siteWraps.length > 0 && (
          <>
            <span className="eyebrow sub">{t("lab.siteWraps")}</span>
            <div className="wrap-thumbs">
              {siteWraps.map((d) => (
                <button
                  key={d.id}
                  className={"wrap-thumb " + (choice.kind === "design" && choice.id === d.id ? "active" : "")}
                  onClick={() => pickDesign(d)}
                  title={d.title}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={d.image} alt={d.title} loading="lazy" />
                  <span>{d.title}</span>
                </button>
              ))}
            </div>
          </>
        )}
        <span className="eyebrow sub">{t("lab.finishes")}</span>
        <div className="swatches" role="radiogroup" aria-label={t("lab.stepWrap")}>
          {FINISHES.map((f) => (
            <button
              key={f.id}
              role="radio"
              aria-checked={choice.kind === "finish" && choice.id === f.id}
              className={"swatch " + (choice.kind === "finish" && choice.id === f.id ? "active" : "")}
              style={{ background: f.color }}
              title={f.label}
              onClick={() => pickFinish(f)}
            >
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <h3>
          {model.name} <em>· {wrapLabel}</em>
        </h3>
        <p>{t("lab.desc", { finish: wrapLabel })}</p>
        <a className="btn primary" href={`https://wa.me/${waNum}?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer">
          {t("lab.cta", { model: model.name, wrap: wrapLabel })}
        </a>
      </div>
    </div>
  );
}
