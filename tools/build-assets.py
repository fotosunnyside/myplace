"""
Export web assets for the PLACES world from upscaled source art.

Pipeline (see tools/README.md):
  1. tools/prep.py          cut placeholder art out of the reference mockups, inpaint baked-in UI
  2. tools/sr.py            4x super-resolution (Real-ESRGAN x4plus)
  3. tools/build-assets.py  this file: compose layers and write /public assets

Usage: python3 tools/build-assets.py <upscaled-dir> <repo-root>

When real illustration arrives, drop it into <upscaled-dir> with the same names
(world.png at any 1286:764 multiple, etc.) and re-run this script.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

UP, ROOT = sys.argv[1], sys.argv[2]
PUB = os.path.join(ROOT, 'public')
WORLD_W, WORLD_H = 1286, 764
SCALE = 2  # exported asset density relative to world units

# Must match lib/world/districts.ts
HOTSPOTS = {
    'yourplace': [[55, 470], [60, 380], [110, 300], [175, 255], [300, 250], [390, 280], [450, 330], [470, 400], [430, 440], [380, 500], [300, 545], [240, 560], [130, 550]],
    'mindplace': [[430, 300], [410, 230], [455, 150], [530, 70], [600, 28], [680, 40], [740, 80], [830, 120], [900, 170], [905, 260], [850, 300], [760, 330], [700, 400], [640, 395], [560, 340], [480, 330]],
    'marketplace': [[405, 470], [500, 425], [600, 410], [700, 420], [790, 440], [880, 480], [960, 560], [945, 650], [870, 730], [740, 764], [520, 764], [400, 720], [345, 650], [370, 560]],
    'workplace': [[900, 310], [935, 240], [960, 185], [1100, 170], [1230, 190], [1286, 250], [1286, 500], [1230, 570], [1100, 580], [990, 520], [930, 470], [870, 420]],
}
BALLOON = (1034, 30, 1136, 156)  # x0, y0, x1, y1 in world units


def out(rel):
    p = os.path.join(PUB, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def save(img, rel, q=82, size=None):
    if size:
        img = img.resize(size, Image.LANCZOS)
    img.save(out(rel), 'WEBP', quality=q, method=6)


# ------------------------------------------------------------------ world
src = Image.open(os.path.join(UP, 'world.png')).convert('RGB')
base = src.resize((WORLD_W * SCALE, WORLD_H * SCALE), Image.LANCZOS)
base = base.filter(ImageFilter.UnsharpMask(radius=1.2, percent=40, threshold=2))

# Balloon sprite: elliptical feathered cut-out, then remove it from the base.
bx0, by0, bx1, by1 = [v * SCALE for v in BALLOON]
sprite = base.crop((bx0, by0, bx1, by1)).convert('RGBA')
m = Image.new('L', sprite.size, 0)
d = ImageDraw.Draw(m)
w, h = sprite.size
d.ellipse((w * 0.14, h * 0.04, w * 0.86, h * 0.72), 255)            # envelope
d.rectangle((w * 0.36, h * 0.6, w * 0.64, h * 0.95), 255)           # ropes + basket
m = m.filter(ImageFilter.GaussianBlur(3 * SCALE))
sprite.putalpha(m)
save(sprite, 'world/balloon.webp', q=90)

try:
    import cv2
    arr = cv2.cvtColor(np.asarray(base), cv2.COLOR_RGB2BGR)
    mask = np.zeros(arr.shape[:2], np.uint8)
    mm = np.asarray(m.resize((bx1 - bx0, by1 - by0)))
    mask[by0:by1, bx0:bx1] = (mm > 20).astype(np.uint8) * 255
    mask = cv2.dilate(mask, np.ones((9, 9), np.uint8), iterations=2)
    # inpaint at half res (smooth sky) then paste back just the masked area
    small = cv2.resize(arr, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
    smask = cv2.resize(mask, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_NEAREST)
    filled = cv2.resize(cv2.inpaint(small, smask, 12, cv2.INPAINT_TELEA), (arr.shape[1], arr.shape[0]))
    soft = cv2.GaussianBlur(mask, (0, 0), 6)[..., None] / 255.0
    arr = (filled * soft + arr * (1 - soft)).astype(np.uint8)
    base_clean = Image.fromarray(cv2.cvtColor(arr, cv2.COLOR_BGR2RGB))
except ImportError:
    base_clean = base

save(base_clean, 'world/world-base.webp', q=84)

# District layers: feathered polygon cut-outs, cropped to their bounding box.
rects = {}
for k, poly in HOTSPOTS.items():
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    pad = 16
    x0, y0 = max(min(xs) - pad, 0), max(min(ys) - pad, 0)
    x1, y1 = min(max(xs) + pad, WORLD_W), min(max(ys) + pad, WORLD_H)
    rects[k] = {'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}
    mask = Image.new('L', base.size, 0)
    ImageDraw.Draw(mask).polygon([(x * SCALE, y * SCALE) for x, y in poly], 255)
    mask = mask.filter(ImageFilter.GaussianBlur(10 * SCALE))
    lay = base_clean.convert('RGBA')
    lay.putalpha(mask)
    save(lay.crop((x0 * SCALE, y0 * SCALE, x1 * SCALE, y1 * SCALE)), f'world/{k}.webp', q=80)
print('layer rects (paste into lib/world/districts.ts):')
print(json.dumps(rects, indent=1))


# ------------------------------------------------------------------ clouds
def cloud_bank(size, puffs, seed, blur=18):
    """Soft cumulus: alpha from blurred circles, colour white with lavender-grey undersides."""
    rng = np.random.default_rng(seed)
    body = Image.new('L', size, 0)
    lit = Image.new('L', size, 0)
    db, dl = ImageDraw.Draw(body), ImageDraw.Draw(lit)
    for (cx, cy, spread, n, r) in puffs:
        for _ in range(n):
            x = cx + rng.normal(0, spread)
            y = cy - abs(rng.normal(0, spread * 0.25))
            rr = r * rng.uniform(0.55, 1.15)
            db.ellipse((x - rr, y - rr, x + rr, y + rr), 255)
            dl.ellipse((x - rr * 0.9, y - rr * 1.1, x + rr * 0.9, y + rr * 0.45), 255)
    a = np.asarray(body.filter(ImageFilter.GaussianBlur(blur)), np.float32) / 255
    l = np.asarray(lit.filter(ImageFilter.GaussianBlur(blur * 2.2)), np.float32) / 255
    white, under = np.array([255, 255, 255], np.float32), np.array([214, 216, 232], np.float32)
    rgb = under + (white - under) * l[..., None]
    rgba = np.dstack([rgb, np.clip(a * 1.08, 0, 1) * 245]).astype(np.uint8)
    return Image.fromarray(rgba, 'RGBA')


drift = cloud_bank((2400, 520), [
    (260, 300, 90, 16, 70), (820, 220, 70, 12, 55), (1450, 330, 110, 18, 80), (2050, 240, 80, 14, 60),
], seed=4, blur=14)
save(drift, 'world/clouds.webp', q=80)

fg = cloud_bank((2600, 520), [
    (140, 430, 160, 30, 120), (700, 480, 170, 26, 110), (1300, 500, 200, 26, 100),
    (1900, 480, 170, 26, 110), (2460, 430, 160, 30, 120),
], seed=11, blur=16)
save(fg, 'world/foreground.webp', q=80)

# ------------------------------------------------------------------ mobile world
mob = Image.open(os.path.join(UP, 'mobile.png')).convert('RGB')
mob = mob.filter(ImageFilter.UnsharpMask(radius=1.2, percent=35, threshold=2))
save(mob, 'world/mobile-world.webp', q=84)

# ------------------------------------------------------------------ districts
for k in HOTSPOTS:
    save(Image.open(os.path.join(UP, f'banner_{k}.png')).convert('RGB'), f'districts/{k}-banner.webp', q=84)
    save(Image.open(os.path.join(UP, f'card_{k}.png')).convert('RGB'), f'districts/{k}-card.webp', q=82)

# ------------------------------------------------------------------ media thumbnails
media = {
    'avatar_josie': ('avatar-josie', (256, 256)),
    'avatar_a': ('avatar-a', (128, 128)),
    'avatar_b': ('avatar-b', (128, 128)),
    'avatar_c': ('avatar-c', (128, 128)),
    'post_landscape': ('post-landscape', None),
    'shop_sunsoil': ('shop-sunsoil', None),
    'shop_luna': ('shop-luna', None),
    'shop_bloom': ('shop-bloom', None),
    'prod_prints': ('prod-prints', None),
    'prod_hanger': ('prod-hanger', None),
    'prod_journal': ('prod-journal', None),
    'prod_mug': ('prod-mug', None),
}
for k, (name, size) in media.items():
    save(Image.open(os.path.join(UP, f'{k}.png')).convert('RGB'), f'media/{name}.webp', q=84, size=size)

# Learning covers: crops of the high-res world (world units), readable at card size.
for name, (x0, y0, x1, y1) in {
    'learn-sustainable': (150, 245, 430, 410),
    'learn-health': (600, 250, 900, 430),
}.items():
    save(base_clean.crop((x0 * SCALE, y0 * SCALE, x1 * SCALE, y1 * SCALE)), f'media/{name}.webp', q=84)
save(Image.open(os.path.join(UP, 'card_mindplace.png')).convert('RGB'), 'media/learn-digital.webp', q=84)

mb = Image.open(os.path.join(UP, 'banner_mindplace.png')).convert('RGB')
W, H = mb.size
save(mb.crop((int(W * 0.66), int(H * 0.1), W, int(H * 0.95))), 'media/banner-mindplace-thumb.webp', q=82)

print('done')
