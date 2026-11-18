// R7 stills for the home pages: the design files drawn the same way as the 3D viewer (matte, outlined,
// never photoreal). Parameters come from the URL: w, h, yaw, pitch, open, hide, outline, edge, margin,
// style (clay | toon), hemi, key, rim.
// Offline still renders of the R7 design files (no photoreal materials: matte, outlined, like the site's 3D viewer).
import * as THREE from "../../assets/vendor/three.module.min.js";
const q = new URLSearchParams(location.search);
const W = +q.get("w") || 1200, H = +q.get("h") || 1200;
const style = q.get("style") || "clay";          // clay | toon
const yaw = +(q.get("yaw") ?? -0.62), pitch = +(q.get("pitch") ?? 0.36);
const open = +(q.get("open") ?? 0);
const hide = (q.get("hide") || "").split(",").filter(Boolean);
const outline = +(q.get("outline") ?? 1.4);
const [meta, bin] = await Promise.all([fetch("../../assets/model/crown.json").then(r => r.json()), fetch("../../assets/model/crown.bin").then(r => r.arrayBuffer())]);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.setClearColor(0, 0);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000); camera.up.set(0, 0, 1); scene.add(camera);
if (style === "toon") {
  scene.add(new THREE.AmbientLight(0xffffff, 1.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.9); key.position.set(-0.45, 0.65, 0.62); camera.add(key, key.target); key.target.position.set(0, 0, -1);
} else {
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4c9cd, +(q.get("hemi") ?? 1.55)));
  const key = new THREE.DirectionalLight(0xfffaf2, +(q.get("key") ?? 1.15)); key.position.set(-0.6, 0.75, 0.7); camera.add(key, key.target); key.target.position.set(0, 0, -1);
  const rim = new THREE.DirectionalLight(0xe6f7ff, +(q.get("rim") ?? 0.9)); rim.position.set(0.9, -0.2, -0.6); camera.add(rim, rim.target); rim.target.position.set(0, 0, -1);
}
const ramp = new THREE.DataTexture(new Uint8Array([150, 205, 255]), 3, 1, THREE.RedFormat);
ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
const TONE = { housing: 0xffffff, cover: 0xffffff, lights: 0xf2f5f7, board: 0xc9ecf4, mount: 0xe4e9ed, other: 0xffffff };
const INK = new THREE.Color(q.get("ink") || "#2c3237"), CYAN = new THREE.Color(0x0091b3);
const fillFor = (p) => p.kind === "optic" ? 0xbdeffa : p.kind === "paint" ? 0x2c3237 : p.kind === "rubber" ? (style === "toon" ? 0xb9c2ca : 0x3b4148) : TONE[p.group] || 0xffffff;
const inkFor = (p) => p.group === "board" ? CYAN : INK;
const ow = { value: 0.4 };
const hullMat = (c) => new THREE.ShaderMaterial({ uniforms: { width: ow, color: { value: c } },
  vertexShader: `attribute vec3 hullNormal; uniform float width; void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position+normalize(hullNormal)*width,1.0); }`,
  fragmentShader: `uniform vec3 color; void main(){ gl_FragColor = vec4(color,1.0); }`, side: THREE.BackSide });
const group = new THREE.Group(); scene.add(group);
const parts = [];
for (const p of meta.parts) {
  if (hide.some(h => p.name.startsWith(h) || p.group === h)) continue;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bin, p.pos, p.count * 3), 3));
  geo.setAttribute("hullNormal", new THREE.BufferAttribute(new Int8Array(bin, p.hull, p.count * 4), 4, true));
  geo.setIndex(new THREE.BufferAttribute(p.idx32 ? new Uint32Array(bin, p.idx, p.idxCount) : new Uint16Array(bin, p.idx, p.idxCount), 1));
  const n8 = new Int8Array(bin, p.nrm, p.count * 4), n = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { n[3*i] = n8[4*i]/127; n[3*i+1] = n8[4*i+1]/127; n[3*i+2] = n8[4*i+2]/127; }
  geo.setAttribute("normal", new THREE.BufferAttribute(n, 3));
  const mat = style === "toon"
    ? new THREE.MeshToonMaterial({ color: fillFor(p), gradientMap: ramp, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })
    : new THREE.MeshLambertMaterial({ color: fillFor(p), polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const holder = new THREE.Group();
  const fill = new THREE.Mesh(geo, mat);
  const flat = p.kind === "paint" || p.kind === "optic";
  if (flat || outline === 0) holder.add(fill); else holder.add(new THREE.Mesh(geo, hullMat(inkFor(p))), fill);
  if (p.edgeCount && !flat && outline > 0) {
    const eg = new THREE.BufferGeometry();
    eg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(bin, p.edges, p.edgeCount * 6), 3));
    holder.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: inkFor(p), transparent: true, opacity: +(q.get("edge") ?? 0.55) })));
  }
  const k = p.group === "mount" ? 1.35 : p.group === "cover" ? 1.25 : 1.1;
  const shift = new THREE.Vector3(...p.shift).multiplyScalar(k); if (p.group === "board") shift.z += 46;
  holder.position.copy(shift).multiplyScalar(open);
  parts.push(holder); group.add(holder);
}
const box = new THREE.Box3().setFromObject(group); group.position.sub(box.getCenter(new THREE.Vector3()));
const radius = box.getSize(new THREE.Vector3()).length() / 2, d = radius * 4;
camera.position.set(Math.sin(yaw) * Math.cos(pitch) * d, -Math.cos(yaw) * Math.cos(pitch) * d, Math.sin(pitch) * d);
camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true); group.updateMatrixWorld(true);
// frame tightly on projected geometry
let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; const v = new THREE.Vector3();
group.traverse(o => { if (o.isMesh && o.geometry.attributes.position) { const a = o.geometry.attributes.position; for (let i = 0; i < a.count; i += 3) { v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).applyMatrix4(camera.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); } } });
const margin = +(q.get("margin") || 1.04), aspect = W / H;
let hw = (x1 - x0) / 2 * margin, hh = (y1 - y0) / 2 * margin;
if (hw / hh > aspect) hh = hw / aspect; else hw = hh * aspect;
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
camera.left = cx - hw; camera.right = cx + hw; camera.top = cy + hh; camera.bottom = cy - hh; camera.updateProjectionMatrix();
ow.value = outline * (2 * hh) / H;
renderer.render(scene, camera);
window.done = true;
