#!/usr/bin/env python3
"""Every still the home pages take from the design files, in one run.

    python3 -m http.server 8766 &          # from the repository root
    python3 tools/stills/stills.py

Writes into assets/media/:
  r8-render.webp            hero (1100 px tall) and r8-front.webp (640 px tall), in the unit's real colours
  lights/*.png              the lens masks of the status-light demo, cut on the hero still, and prints the
                            BOX table to paste into assets/lights.js
  evo-r6.webp, evo-r7.webp, evo-r8.webp
                            the three enclosures drawn alike at one scale, for the "Évolution" section

The earlier enclosures are read from tools/stills/_models/r6 and r7 (not committed). Recreate them with:
    mkdir -p tools/stills/_models/r6 tools/stills/_models/r7
    for f in bin json; do git show 9ea16e1:assets/model/crown.$f > tools/stills/_models/r6/crown.$f
                          git show b23e59a:assets/model/crown.$f > tools/stills/_models/r7/crown.$f; done
Needs: node with playwright, pillow, numpy.
"""
import json
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent.parent
MEDIA = ROOT / "assets" / "media"
TMP = Path(tempfile.mkdtemp(prefix="kurant-stills-"))
LOOK = "edge=0.55&outline=1.3&hemi=1.35&key=1.55&rim=2.2"
HERO = "w=1400&h=1400&yaw=-0.72&pitch=0.22&margin=1.01"
FRONT = "w=900&h=900&yaw=-0.4&pitch=0.14&margin=1.01"
EVO = "w=1000&h=1000&yaw=-0.72&pitch=0.22&span=170"       # 170 mm of height in 1000 px for all three


def shoot(name, query):
    out = TMP / f"{name}.png"
    subprocess.run(["node", str(ROOT / "tools/stills/shoot.js"), str(out), query], check=True, cwd=ROOT)
    return Image.open(out).convert("RGBA")


def content_box(im):
    return im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()


def export(im, path, height):
    w = round(im.width * height / im.height)
    im.resize((w, height), Image.LANCZOS).save(path, "WEBP", quality=88, method=6)
    return w, height


# ---- Hero and front stills -------------------------------------------------------------------
hero = shoot("hero", f"palette=real&{HERO}&{LOOK}")
box = content_box(hero)
hero_size = export(hero.crop(box), MEDIA / "r8-render.webp", 1100)
front = shoot("front", f"palette=real&{FRONT}&edge=0.55&outline=1.2&hemi=1.45&key=1.45&rim=2.0")
front_size = export(front.crop(content_box(front)), MEDIA / "r8-front.webp", 640)
print("r8-render.webp", hero_size, " r8-front.webp", front_size)

# ---- Lens masks on the hero still ------------------------------------------------------------
# Firmware pixels 0 to 2 are the light line. In the R8 the line has five LEDs and each side slit three:
# pixel 0 drives line LEDs 1-2 and the left slit, pixel 1 line LED 3, pixel 2 line LEDs 4-5 and the right slit.
W, H = hero_size


def mask(names):
    m = shoot("mask_" + names.replace(",", "_"), f"{HERO}&mask={names}").crop(box).resize((W, H), Image.LANCZOS)
    return np.array(m.getchannel("A")).astype(float) / 255


def soften(m, grow=1):
    img = Image.fromarray((np.clip(m, 0, 1) * 255).astype("uint8"))
    img = img.filter(ImageFilter.MaxFilter(2 * grow + 1)).filter(ImageFilter.GaussianBlur(1.1))
    return np.array(img).astype(float) / 255


logo, line = mask("LensLogo"), mask("LensLine")
side_l, side_r = mask("LensSideL"), mask("LensSideR")
ys, xs = np.nonzero(line > 0.5)
P = np.c_[xs, ys].astype(float)
c = P.mean(0)
ax = np.linalg.svd(P - c)[2][0]
ax = ax if ax[0] > 0 else -ax                      # left to right on the still = LED 1 to LED 5
yy, xx = np.mgrid[0:H, 0:W]
t = ((np.c_[xx.ravel(), yy.ravel()] - c) @ ax).reshape(H, W)
t0, t1 = ((P - c) @ ax).min(), ((P - c) @ ax).max()
length = t1 - t0

boxes = {}
(MEDIA / "lights").mkdir(exist_ok=True)


def save(name, m):
    m = soften(m)
    ys, xs = np.nonzero(m > 0.02)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), "uint8")
    rgba[..., :3] = 255
    rgba[..., 3] = (m[y0:y1, x0:x1] * 255).astype("uint8")
    Image.fromarray(rgba).save(MEDIA / "lights" / f"{name}.png", optimize=True)
    boxes[name] = [round(x0 / W * 100, 3), round(y0 / H * 100, 3), round((x1 - x0) / W * 100, 3), round((y1 - y0) / H * 100, 3)]


def stretch(centre, share):
    """The part of the line lit by LEDs spanning `share` of its length around `centre` (both 0..1), soft-edged."""
    half = share * length / 2
    return line * np.clip(1 - (np.abs(t - (t0 + centre * length)) - half * 0.8) / (half * 0.6), 0, 1)


save("logo", logo)
save("line", np.maximum(line, np.maximum(side_l, side_r)))        # everything pixels 0 to 2 light, unlit
save("line0", np.maximum(stretch(0.2, 0.4), side_l))
save("line1", stretch(0.5, 0.2))
save("line2", np.maximum(stretch(0.8, 0.4), side_r))
print("BOX for assets/lights.js (", W, "x", H, "):")
print(json.dumps(boxes, indent=1))

# ---- The three enclosures at one scale ---------------------------------------------------------
shots = {}
for rev in ("r6", "r7", "r8"):
    model = "" if rev == "r8" else f"model=_models/{rev}&"
    if rev != "r8" and not (ROOT / "tools/stills/_models" / rev / "crown.bin").exists():
        raise SystemExit(f"tools/stills/_models/{rev} is missing: see the top of this file")
    im = shoot("evo_" + rev, f"{model}{EVO}&{LOOK}")
    shots[rev] = im.crop(content_box(im))
# One height for all three, so the page shows them at one scale by giving them one height. Each keeps
# its own width. The R6's cable hangs below its body: the bodies share a floor line above it.
FLOOR = {"r6": 190, "r7": 0, "r8": 0}          # px of the drawing under the floor line (the R6's cable)
top = max(im.height - FLOOR[rev] for rev, im in shots.items())
ch = top + max(FLOOR.values()) + 20
for rev, im in shots.items():
    canvas = Image.new("RGBA", (im.width + 20, ch), (0, 0, 0, 0))
    canvas.alpha_composite(im, (10, 10 + top - (im.height - FLOOR[rev])))
    print(f"evo-{rev}.webp", export(canvas, MEDIA / f"evo-{rev}.webp", 560), "drawn", im.size)
print("scale: 1000 px for 170 mm before the export to 560 px tall")
