/* "Le module, ouvert": the Kurant module from its design files (Crown R7), in 3D.
   Scrolling through the section opens it part by part; dragging turns it.
   Loaded only when the section comes near the screen. Falls back to the animation video when WebGL
   isn't available, and stays still (slider only) for people who ask for reduced motion. */
const root = document.querySelector("[data-m3d]");
if (root) { start(root); dialog(root); }

// "Voir l'animation": the R7 design-file animation in a dialog. Works with or without WebGL.
function dialog(root) {
  const dlg = root.querySelector(".m3d-dialog");
  const open = root.querySelector("[data-video-open]");
  if (!dlg || !open || typeof dlg.showModal !== "function") { if (open) open.hidden = true; return; }
  const video = dlg.querySelector("video");
  open.addEventListener("click", () => { dlg.showModal(); video.play().catch(() => {}); });
  const close = () => { video.pause(); dlg.close(); };
  dlg.querySelector("[data-video-close]").addEventListener("click", close);
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener("close", () => video.pause());
}

function start(root) {
  const stage = root.querySelector(".m3d-stage");
  const slider = root.querySelector(".m3d-slider");
  const steps = Array.from(root.querySelectorAll("[data-step]"));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const base = new URL(".", import.meta.url);

  // Load three.js and the model when the section is about one screen away.
  const near = new IntersectionObserver((entries) => {
    if (!entries.some((e) => e.isIntersecting)) return;
    near.disconnect();
    boot().catch((err) => { console.error("3D viewer", err); fallback(); });
  }, { rootMargin: "800px 0px" });
  near.observe(root);

  function fallback() {
    root.classList.add("m3d-fallback");
    const loading = root.querySelector(".m3d-loading");
    if (loading) loading.hidden = true;
    const v = root.querySelector(".m3d-video");
    if (v) { v.hidden = false; v.preload = "metadata"; }
  }

  async function boot() {
    const probe = document.createElement("canvas");
    if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return fallback();

    const [THREE, meta, bin] = await Promise.all([
      import(new URL("vendor/three.module.min.js", base).href),
      fetch(new URL("model/crown.json", base)).then((r) => r.json()),
      fetch(new URL("model/crown.bin", base)).then((r) => r.arrayBuffer()),
    ]);

    /* ---- Scene ---- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const canvas = renderer.domElement;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", stage.getAttribute("data-label") || "");
    stage.prepend(canvas);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
    camera.up.set(0, 0, 1);
    scene.add(camera);
    scene.add(new THREE.AmbientLight(0xffffff, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.9);
    key.position.set(-0.45, 0.65, 0.62);           // up-left-front of the camera, as in the animation
    camera.add(key, key.target);
    key.target.position.set(0, 0, -1);

    // Three flat tones, so the shape reads like a technical illustration rather than a render.
    const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.needsUpdate = true;

    const TONE = { housing: 0xffffff, cover: 0xffffff, lights: 0xf2f5f7, board: 0xc9ecf4, mount: 0xe4e9ed, other: 0xffffff };
    const INK = new THREE.Color(0x2c3237), CYAN = new THREE.Color(0x0091b3), HW = new THREE.Color(0x6f7880);
    // Lenses read as the status lights (pale cyan), the KURANT paint fill as ink.
    const fillFor = (p) => p.kind === "optic" ? 0xbdeffa : p.kind === "paint" ? 0x2c3237 : p.kind === "hardware" ? 0xd3d9de
      : p.kind === "rubber" ? 0xb9c2ca : TONE[p.group] || 0xffffff;
    const inkFor = (p) => p.group === "board" ? CYAN : p.kind === "hardware" ? HW : INK;

    const outlineUniforms = { width: { value: 0.4 } };
    const hullMaterial = (color) => new THREE.ShaderMaterial({
      uniforms: { width: outlineUniforms.width, color: { value: color } },
      vertexShader: `attribute vec3 hullNormal; uniform float width;
        void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(hullNormal) * width, 1.0); }`,
      fragmentShader: `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
      side: THREE.BackSide,
    });

    const group = new THREE.Group();
    scene.add(group);
    const parts = [];
    for (const p of meta.parts) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bin, p.pos, p.count * 3), 3));
      geo.setAttribute("hullNormal", new THREE.BufferAttribute(new Int8Array(bin, p.hull, p.count * 4), 4, true));
      geo.setIndex(new THREE.BufferAttribute(p.idx32 ? new Uint32Array(bin, p.idx, p.idxCount) : new Uint16Array(bin, p.idx, p.idxCount), 1));
      // Three.js expects 3-component normals: copy into a float attribute (the 4th byte is padding).
      const n8 = new Int8Array(bin, p.nrm, p.count * 4), n = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) { n[3 * i] = n8[4 * i] / 127; n[3 * i + 1] = n8[4 * i + 1] / 127; n[3 * i + 2] = n8[4 * i + 2] / 127; }
      geo.setAttribute("normal", new THREE.BufferAttribute(n, 3));

      const holder = new THREE.Group();
      const fill = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: fillFor(p), gradientMap: ramp,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      const hull = new THREE.Mesh(geo, hullMaterial(inkFor(p)));
      // The KURANT paint fill and the lenses sit in openings of the shell, whose own outline frames them:
      // no outline shell or edge lines of their own (they would bloat the letters and spill past the windows).
      const flat = p.kind === "paint" || p.kind === "optic";
      if (flat) holder.add(fill); else holder.add(hull, fill);
      if (p.edgeCount && !flat) {
        const eg = new THREE.BufferGeometry();
        eg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bin, p.edges, p.edgeCount * 6), 3));
        holder.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: inkFor(p), transparent: true, opacity: 0.55 })));
      }
      // Wider spread for the clip and the back plate so nothing hides the board when open.
      const k = p.group === "mount" ? 1.35 : p.group === "cover" ? 1.25 : 1.1;
      const shift = new THREE.Vector3(...p.shift).multiplyScalar(k);
      // The board also rises above the rest, so the open view shows it unhidden.
      if (p.group === "board") shift.z += 46;
      parts.push({ p, holder, shift, fill });
      group.add(holder);
    }

    // The handlebar, as a quiet reference that fades out as the module opens.
    const barMat = new THREE.MeshBasicMaterial({ color: 0xc9d0d6, transparent: true, opacity: 0.55, depthWrite: false });
    const barGeo = new THREE.CylinderGeometry(15.9, 15.9, 240, 48, 1, true);
    barGeo.rotateZ(Math.PI / 2);
    barGeo.translate(0, 38.3, 18);                  // 31.8 mm bar in the R7 clip (CAD frame)
    const bar = new THREE.Mesh(barGeo, barMat);
    bar.renderOrder = -1;
    group.add(bar);

    // Frame on the fully opened module, so the camera never moves while it opens.
    const box = new THREE.Box3();
    for (const it of parts) {
      it.holder.position.copy(it.shift);
      it.holder.updateMatrixWorld(true);
      box.expandByObject(it.fill);
      it.holder.position.set(0, 0, 0);
    }
    const center = box.getCenter(new THREE.Vector3());
    const radius = box.getSize(new THREE.Vector3()).length() / 2;
    group.position.sub(center);
    // Each part's own box corners, to frame the view on what is actually on screen.
    const corners = parts.map((it) => {
      const b = new THREE.Box3().setFromBufferAttribute(it.fill.geometry.attributes.position);
      const out = [];
      for (let i = 0; i < 8; i++) out.push(new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
      return out;
    });

    /* ---- Labels (HTML, follow their part) ---- */
    const labels = Array.from(root.querySelectorAll("[data-anchor]")).map((el) => {
      const names = el.getAttribute("data-anchor").split(",");
      const its = parts.filter((it) => names.some((n) => it.p.name.startsWith(n)));
      return { el, its };
    });

    /* ---- View state ---- */
    // The view turns from the front-left quarter (closed, as on the bike) to the rear-left quarter
    // (open, where the board shows) while the module opens. Dragging adds to that.
    const YAW_CLOSED = -0.62, YAW_OPEN = -2.35;
    let yaw = 0, pitch = 0.36;
    let explode = 0, target = 0, dirty = true, visible = false;
    let W = 0, H = 0;

    function resize() {
      const r = stage.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      renderer.setSize(W, H, false);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      dirty = true;
    }
    new ResizeObserver(resize).observe(stage);
    resize();

    const ease = (t) => t * t * (3 - 2 * t);

    // Fit the camera to the parts as they stand now (closed, opening or turned), with a margin.
    const pt = new THREE.Vector3(), m = new THREE.Matrix4();
    function frameView() {
      camera.updateMatrixWorld(true);
      group.updateMatrixWorld(true);
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      parts.forEach((it, i) => {
        m.multiplyMatrices(camera.matrixWorldInverse, it.holder.matrixWorld);
        for (const c of corners[i]) {
          pt.copy(c).applyMatrix4(m);
          if (pt.x < x0) x0 = pt.x; if (pt.x > x1) x1 = pt.x;
          if (pt.y < y0) y0 = pt.y; if (pt.y > y1) y1 = pt.y;
        }
      });
      const aspect = W / H, margin = 1.12;
      let hw = (x1 - x0) / 2 * margin, hh = (y1 - y0) / 2 * margin;
      if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      camera.left = cx - hw; camera.right = cx + hw; camera.top = cy + hh; camera.bottom = cy - hh;
      camera.updateProjectionMatrix();
      // Outline about 1.6 CSS px wide whatever the zoom.
      outlineUniforms.width.value = 1.6 * (2 * hh) / H;
    }
    function frame() {
      requestAnimationFrame(frame);
      if (!visible) return;
      if (Math.abs(target - explode) > 0.0005) { explode += (target - explode) * (reduce ? 1 : 0.18); dirty = true; }
      if (!dirty) return;
      dirty = false;
      const e = ease(Math.min(1, Math.max(0, explode)));
      for (const it of parts) it.holder.position.copy(it.shift).multiplyScalar(e);
      barMat.opacity = 0.55 * (1 - Math.min(1, e * 2.5));
      bar.visible = barMat.opacity > 0.01;
      const d = radius * 4;
      const a = YAW_CLOSED + (YAW_OPEN - YAW_CLOSED) * e + yaw;
      const el = pitch + 0.16 * e;
      camera.position.set(Math.sin(a) * Math.cos(el) * d, -Math.cos(a) * Math.cos(el) * d, Math.sin(el) * d);
      camera.lookAt(0, 0, 0);
      frameView();
      renderer.render(scene, camera);
      placeLabels(e);
    }

    const v = new THREE.Vector3();
    function placeLabels(e) {
      const show = e > 0.72;
      for (const l of labels) {
        if (!show || !l.its.length) { l.el.classList.remove("on"); continue; }
        v.set(0, 0, 0);
        const b = new THREE.Box3();
        for (const it of l.its) { it.holder.updateMatrixWorld(true); b.expandByObject(it.fill); }
        b.getCenter(v).project(camera);
        // Keep the whole label inside the card.
        const x = Math.min(((v.x + 1) / 2) * W, W - l.el.offsetWidth - 20);
        const y = Math.min(Math.max(((1 - v.y) / 2) * H, 24), H - 16);
        l.el.style.transform = `translate(${x}px, ${y}px)`;
        l.el.classList.add("on");
      }
    }

    new IntersectionObserver((entries) => {
      visible = entries.some((e) => e.isIntersecting);
      if (visible) dirty = true;
    }).observe(stage);
    requestAnimationFrame(frame);

    /* ---- Scroll drives the opening; the slider mirrors it and can drive it too ---- */
    function setStep(e) {
      const i = e < 0.15 ? 0 : e < 0.5 ? 1 : e < 0.85 ? 2 : 3;
      steps.forEach((s, k) => s.classList.toggle("on", k === i));
    }
    function fromScroll() {
      const r = root.getBoundingClientRect();
      const span = r.height - innerHeight;
      if (span <= 0) return;
      const p = Math.min(1, Math.max(0, -r.top / span));
      // 0-15 % closed, open by 70 %, hold to the end.
      target = Math.min(1, Math.max(0, (p - 0.15) / 0.55));
      slider.value = String(Math.round(target * 100));
      setStep(target);
    }
    if (!reduce) {
      addEventListener("scroll", fromScroll, { passive: true });
      fromScroll();
    } else {
      root.classList.add("m3d-still");
      setStep(0);
    }
    slider.addEventListener("input", () => {
      target = Number(slider.value) / 100;
      if (reduce) explode = target;
      setStep(target);
      dirty = true;
    });

    /* ---- Drag to turn (horizontal on touch, so vertical swipes still scroll the page) ---- */
    let drag = null;
    canvas.addEventListener("pointerdown", (ev) => {
      drag = { x: ev.clientX, y: ev.clientY, yaw, pitch, touch: ev.pointerType === "touch" };
      canvas.setPointerCapture(ev.pointerId);
      root.classList.add("m3d-turned");
    });
    canvas.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      yaw = drag.yaw - (ev.clientX - drag.x) * 0.008;
      if (!drag.touch) pitch = Math.min(1.2, Math.max(-0.1, drag.pitch + (ev.clientY - drag.y) * 0.006));
      dirty = true;
    });
    const end = () => { drag = null; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("dblclick", () => { yaw = 0; pitch = 0.36; dirty = true; });

    root.classList.add("m3d-ready");
    const loading = root.querySelector(".m3d-loading");
    if (loading) loading.hidden = true;
  }
}
