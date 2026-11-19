"""Lay the R7 animation frames on the studio background with their captions, then encode.

    python3 tools/r7-stills/compose.py <frames-dir> <inter-regular.ttf> <inter-semibold.ttf>

Writes assets/media/crown_r7_story_680.mp4 (12 s, 30 fps, 680x850) and assets/media/crown-r7-poster.jpg.
Captions are bilingual, as the video is shared by both languages.
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

FRAMES, REG, SEMI = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
W, H = 1020, 1275          # drawn size; encoded at 680x850
OUT = Path("assets/media")
CAPTIONS = [
    ("Logo : téléphone connecté · ligne : alimenté", "Logo: phone connected · line: powered"),
    ("Attache sans outil, guidons de 22,2 à 35 mm", "Tool-free clip, 22.2 to 35 mm bars"),
    ("Coque d'une pièce, joint continu, circuit tenu sans vis", "One-piece shell, continuous seal, board held without screws"),
    ("62 × 85 × 29 mm, 41 % plus mince", "62 × 85 × 29 mm, 41% thinner"),
]
TOP = "Animation des fichiers de conception R7 · Animated from the R7 design files"


def studio():
    """Graphite with a soft light behind the module and a faint drawing grid."""
    bg = Image.new("RGB", (W, H), (17, 19, 22))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W * 0.08, H * 0.12, W * 0.92, H * 0.78), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    bg = Image.composite(Image.new("RGB", (W, H), (44, 51, 58)), bg, glow)
    grid = ImageDraw.Draw(bg, "RGBA")
    for x in range(0, W, 36):
        grid.line([(x, 0), (x, H)], fill=(255, 255, 255, 9))
    for y in range(0, H, 36):
        grid.line([(0, y), (W, y)], fill=(255, 255, 255, 9))
    return bg


def main():
    meta = json.loads((FRAMES / "frames.json").read_text())
    base = studio()
    f_top, f_fr, f_en = ImageFont.truetype(REG, 19), ImageFont.truetype(SEMI, 31), ImageFont.truetype(REG, 22)
    tmp = FRAMES / "out"
    tmp.mkdir(exist_ok=True)
    for i, m in enumerate(meta):
        frame = base.copy()
        model = Image.open(FRAMES / f"f{i:04d}.png").convert("RGBA")
        shadow = Image.new("L", (W, H), 0)
        ImageDraw.Draw(shadow).ellipse((W * 0.2, H * 0.74, W * 0.8, H * 0.79), fill=150)
        frame.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(28)))
        frame.paste(model, (0, -40), model)
        d = ImageDraw.Draw(frame, "RGBA")
        d.text((36, 30), TOP, font=f_top, fill=(160, 168, 175, 255))
        a = min(1.0, m["into"] / 0.35)                      # caption fades in at each shot
        fr, en = CAPTIONS[m["caption"]]
        box = (36, H - 168, W - 36, H - 44)
        d.rounded_rectangle(box, 16, fill=(22, 25, 29, int(230 * a)), outline=(255, 255, 255, int(28 * a)))
        d.rectangle((box[0], box[1] + 22, box[0] + 4, box[3] - 22), fill=(0, 210, 255, int(255 * a)))
        d.text((box[0] + 30, box[1] + 24), fr, font=f_fr, fill=(242, 244, 245, int(255 * a)))
        d.text((box[0] + 30, box[1] + 74), en, font=f_en, fill=(160, 168, 175, int(255 * a)))
        frame.save(tmp / f"c{i:04d}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "30", "-i", str(tmp / "c%04d.png"),
                    "-vf", "scale=680:850:flags=lanczos", "-c:v", "libx264", "-preset", "slow", "-crf", "23",
                    "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(OUT / "crown_r7_story_680.mp4")], check=True)
    Image.open(tmp / "c0045.png").resize((680, 850), Image.LANCZOS).save(OUT / "crown-r7-poster.jpg", quality=86)


if __name__ == "__main__":
    main()
