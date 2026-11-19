"""Cut the status-light lens masks from the hero render (assets/media/r7-render.webp).

Writes assets/media/lights/{logo,line,line0,line1,line2}.png (white, alpha = lens) and prints
each mask's box in % of the render, for the BOX table in assets/lights.js. Rerun it when the hero
render changes. line0..line2 split the light line into the thirds each of its 3 LEDs lights.

    pip install pillow numpy
    python3 tools/lights-masks.py
"""
import json
import numpy as np
from PIL import Image, ImageFilter

SRC = "assets/media/r7-render.webp"
OUT = "assets/media/lights/"

im = np.array(Image.open(SRC).convert("RGBA")).astype(int)
r, g, b, a = (im[..., i] for i in range(4))
mx = np.maximum(np.maximum(r, g), b)
sat = mx - np.minimum(np.minimum(r, g), b)
H, W = r.shape
yy, xx = np.mgrid[0:H, 0:W]

# The lenses by colour, inside the region where each one sits in this render.
bar = (mx > 150) & (sat < 70) & (a > 200) & (yy < 300) & (xx > 600)        # logo bar, white
tip = (b > 140) & (b - r > 70) & (a > 200) & (yy < 450) & (yy > 250)       # logo tip, cyan
line = (yy > 840) & (yy < 1000) & (xx > 560) & (xx < 910) & (a > 200) & (mx > 100) & (sat < 50)


def clean(m, grow=2):
    img = Image.fromarray((m * 255).astype("uint8"))
    img = img.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.MinFilter(3))
    img = img.filter(ImageFilter.MaxFilter(2 * grow + 1)).filter(ImageFilter.GaussianBlur(1.1))
    return np.array(img).astype(float) / 255


L, B, T = clean(line), clean(bar), clean(tip)
ys, xs = np.nonzero(line)
P = np.c_[xs, ys].astype(float)
c = P.mean(0)
ax = np.linalg.svd(P - c)[2][0]
ax = ax if ax[0] > 0 else -ax
t = ((np.c_[xx.ravel(), yy.ravel()] - c) @ ax).reshape(H, W)
tmin, tmax = ((P - c) @ ax).min(), ((P - c) @ ax).max()

boxes = {}


def save(name, M):
    ys, xs = np.nonzero(M > 0.02)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    rgba = np.zeros((y1 - y0, x1 - x0, 4), "uint8")
    rgba[..., :3] = 255
    rgba[..., 3] = (M[y0:y1, x0:x1] * 255).astype("uint8")
    Image.fromarray(rgba).save(OUT + name + ".png", optimize=True)
    boxes[name] = [round(x0 / W * 100, 3), round(y0 / H * 100, 3), round((x1 - x0) / W * 100, 3), round((y1 - y0) / H * 100, 3)]


save("logo", np.maximum(B, T))
seg = (tmax - tmin) / 3
for i in range(3):
    centre = tmin + seg * (i + 0.5)
    save(f"line{i}", L * np.clip(1 - (np.abs(t - centre) - seg * 0.38) / (seg * 0.45), 0, 1))
save("line", L)
print(json.dumps(boxes, indent=1))
