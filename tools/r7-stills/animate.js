// The 12 s R7 story animation, from the design files in the beta unit's real colours.
// From the repository root: python3 -m http.server 8766, then
//   node tools/r7-stills/animate.js <frames-dir>
// It writes one transparent PNG per frame (30 fps) and frames.json (the caption for each frame);
// tools/r7-stills/compose.py then lays them on the studio background with the captions and encodes
// the MP4 and the poster.
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const FPS = 30, SECONDS = 12, W = 1020, H = 1275;   // drawn at 1.5x, encoded at 680x850
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// Shots: [start s, end s, from, to, caption index]. Angles in radians (yaw 0 = facing the front).
const SHOTS = [
  [0.0, 3.0, { yaw: -0.85, pitch: 0.20, open: 0 }, { yaw: -0.45, pitch: 0.16, open: 0 }, 0],
  [3.0, 5.6, { yaw: -0.45, pitch: 0.16, open: 0 }, { yaw: 2.45, pitch: 0.22, open: 0 }, 1],
  [5.6, 9.4, { yaw: 2.45, pitch: 0.22, open: 0 }, { yaw: 5.5, pitch: 0.26, open: 1 }, 2],
  [9.4, 12.0, { yaw: 5.5, pitch: 0.26, open: 1 }, { yaw: 5.45, pitch: 0.18, open: 0 }, 3],
];

(async () => {
  const out = process.argv[2];
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on("pageerror", (e) => console.error(e.message));
  const q = `anim=1&open=1&palette=real&board=illus&w=${W}&h=${H}&edge=0.55&outline=1.3&hemi=1.35&key=1.55&rim=2.2`;
  await page.goto(`http://localhost:8766/tools/r7-stills/index.html?${q}`);
  await page.waitForFunction(() => window.done, null, { timeout: 60000 });
  const captions = [];
  for (let f = 0; f < FPS * SECONDS; f++) {
    const t = f / FPS;
    const shot = SHOTS.find((s) => t >= s[0] && t < s[1]) || SHOTS[SHOTS.length - 1];
    const k = ease(Math.min(1, (t - shot[0]) / (shot[1] - shot[0])));
    const st = { yaw: lerp(shot[2].yaw, shot[3].yaw, k), pitch: lerp(shot[2].pitch, shot[3].pitch, k), open: lerp(shot[2].open, shot[3].open, k) };
    // Closer when closed, wider when open, so the module always fills the frame.
    st.zoom = lerp(1.55, 1.0, st.open);
    const url = await page.evaluate((s) => window.frame(s.yaw, s.pitch, s.open, s.zoom), st);
    fs.writeFileSync(path.join(out, `f${String(f).padStart(4, "0")}.png`), Buffer.from(url.split(",")[1], "base64"));
    captions.push({ caption: shot[4], into: t - shot[0] });
  }
  fs.writeFileSync(path.join(out, "frames.json"), JSON.stringify(captions));
  await browser.close();
})();
