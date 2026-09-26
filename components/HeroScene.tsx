"use client";

import { useEffect, useRef } from "react";

/**
 * HeroScene — interactive 3D hero for FOLJE EXPRESS.
 * Chrome torus-knot "foil sculpture", orbiting rings, particle field and
 * mouse parallax. Rendered with three.js, lazily imported, fully disposed
 * on unmount and paused when the tab is hidden.
 */
export default function HeroScene({ accent = "#5bc7ff" }: { accent?: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let cleanup = () => {};

    import("three").then((THREE) => {
      if (disposed || !hostRef.current) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
      camera.position.set(0, 0, 5.6);

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      host.appendChild(renderer.domElement);

      const setSize = () => {
        const w = Math.max(host.clientWidth, 1);
        const h = Math.max(host.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h, false);
      };
      setSize();

      /* --- environment for realistic chrome reflections --- */
      let envDispose = () => {};
      const pmrem = new THREE.PMREMGenerator(renderer);
      import("three/examples/jsm/environments/RoomEnvironment.js").then(({ RoomEnvironment }) => {
        if (disposed) return;
        const envScene = new RoomEnvironment();
        const envMap = pmrem.fromScene(envScene, 0.04).texture;
        scene.environment = envMap;
        envDispose = () => {
          envMap.dispose();
          pmrem.dispose();
          envScene.traverse((o) => {
            const maybe = o as unknown as { geometry?: { dispose(): void } };
            if (maybe.geometry) maybe.geometry.dispose();
          });
        };
      });

      /* --- main foil sculpture --- */
      const knotGeo = new THREE.TorusKnotGeometry(1.35, 0.42, 220, 32, 2, 3);
      const knotMat = new THREE.MeshPhysicalMaterial({
        color: 0x1c1f26,
        metalness: 0.95,
        roughness: 0.16,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
        envMapIntensity: 1.4,
      });
      const knot = new THREE.Mesh(knotGeo, knotMat);
      scene.add(knot);

      /* --- orbiting rings --- */
      const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.5 });
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.012, 8, 160), ringMat);
      const ring2Mat = ringMat.clone();
      ring2Mat.opacity = 0.28;
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.35, 0.008, 8, 160), ring2Mat);
      ring1.rotation.x = Math.PI / 2.6;
      ring2.rotation.x = -Math.PI / 3.1;
      ring2.rotation.y = 0.4;
      scene.add(ring1, ring2);

      /* --- particle field --- */
      const COUNT = 420;
      const positions = new Float32Array(COUNT * 3);
      for (let i = 0; i < COUNT; i++) {
        const r = 3.2 + Math.random() * 4.5;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.6;
        positions[i * 3 + 2] = r * Math.cos(phi) - 2;
      }
      const particleGeo = new THREE.BufferGeometry();
      particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.022,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      /* --- lights --- */
      scene.add(new THREE.HemisphereLight(0xffffff, 0x0a0d14, 1.4));
      const key = new THREE.DirectionalLight(0xffffff, 3.2);
      key.position.set(3, 4, 5);
      scene.add(key);
      const accentLight = new THREE.PointLight(new THREE.Color(accent), 26, 9);
      accentLight.position.set(-3, 1.2, 2);
      scene.add(accentLight);
      const warmLight = new THREE.PointLight(0xff315b, 18, 9);
      warmLight.position.set(3, -2, 1.5);
      scene.add(warmLight);

      /* --- mouse parallax --- */
      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      const onPointer = (e: PointerEvent) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onPointer, { passive: true });

      const onResize = () => setSize();
      window.addEventListener("resize", onResize);

      let raf = 0;
      let running = true;
      const onVisibility = () => {
        running = !document.hidden;
        if (running) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        } else {
          cancelAnimationFrame(raf);
        }
      };
      document.addEventListener("visibilitychange", onVisibility);

      let last = performance.now();
      const tick = () => {
        if (!running) return;
        const now = performance.now();
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        const t = now / 1000;

        knot.rotation.x += dt * 0.16;
        knot.rotation.y += dt * 0.3;
        ring1.rotation.z += dt * 0.12;
        ring2.rotation.z -= dt * 0.08;
        particles.rotation.y += dt * 0.02;

        mouse.x += (mouse.tx - mouse.x) * 0.04;
        mouse.y += (mouse.ty - mouse.y) * 0.04;
        camera.position.x = mouse.x * 0.55;
        camera.position.y = -mouse.y * 0.4 + Math.sin(t * 0.4) * 0.06;
        camera.lookAt(0, 0, 0);

        accentLight.position.x = Math.sin(t * 0.7) * 3.2;
        accentLight.position.y = Math.cos(t * 0.5) * 1.6;

        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", onPointer);
        document.removeEventListener("visibilitychange", onVisibility);
        knotGeo.dispose();
        knotMat.dispose();
        ring1.geometry.dispose();
        ring2.geometry.dispose();
        ringMat.dispose();
        ring2Mat.dispose();
        particleGeo.dispose();
        particleMat.dispose();
        envDispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    });

    return () => {
      disposed = true;
      cleanup();
    };
  }, [accent]);

  return <div className="hero-canvas" ref={hostRef} aria-hidden="true" />;
}
