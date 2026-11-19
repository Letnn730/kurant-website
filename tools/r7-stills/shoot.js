// Render one still of the R7 design files to a transparent PNG.
// From the repository root: python3 -m http.server 8766, then
//   node tools/r7-stills/shoot.js out.png "w=1400&h=1400&yaw=-0.9&pitch=0.26&edge=0.3&outline=1.3&margin=1.01"
// Then crop to the bounding box and export WebP (see README, "R7 stills").
const { chromium } = require("playwright");
(async () => {
  const [out, query] = [process.argv[2], process.argv[3] || ""];
  const q = new URLSearchParams(query);
  const W = +(q.get("w") || 1200), H = +(q.get("h") || 1200);
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: W, height: H } });
  p.on("pageerror", (e) => console.error(e.message));
  await p.goto("http://localhost:8766/tools/r7-stills/index.html?" + query);
  await p.waitForFunction(() => window.done, null, { timeout: 60000 });
  await p.locator("canvas").screenshot({ path: out, omitBackground: true });
  await b.close();
})();
