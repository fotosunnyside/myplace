"""
Cut placeholder art out of the two reference mockups (1536x1024) and inpaint baked-in UI text.

Usage: python3 tools/prep.py <landing-mockup> <dashboard-mockup> <out-dir>
"""
import os, sys, cv2, numpy as np
from PIL import Image

MOCK1, MOCK2, O = sys.argv[1], sys.argv[2], sys.argv[3].rstrip('/') + '/'
os.makedirs(O, exist_ok=True)
load = lambda p: cv2.cvtColor(np.asarray(Image.open(p).convert('RGB')), cv2.COLOR_RGB2BGR)
i1, i2 = load(MOCK1), load(MOCK2)


def inpaint(img, rects, text_rects=(), grow=7, r=9):
    """rects: fully masked rounded boxes (labels). text_rects: only dark/yellow glyph pixels masked."""
    m = np.zeros(img.shape[:2], np.uint8)
    for (x0, y0, x1, y1) in rects:
        cv2.rectangle(m, (x0 - grow, y0 - grow), (x1 + grow, y1 + grow), 255, -1)
    for (x0, y0, x1, y1, thr) in text_rects:
        sub = img[y0:y1, x0:x1].astype(int)
        lum = sub.mean(2)
        b, g, rr = sub[..., 0], sub[..., 1], sub[..., 2]
        yellow = (rr > 200) & (g > 150) & (b < 140)
        glyph = ((lum < thr) | yellow).astype(np.uint8) * 255
        glyph = cv2.dilate(glyph, np.ones((5, 5), np.uint8), iterations=2)
        m[y0:y1, x0:x1] |= glyph
    return cv2.inpaint(img, m, r, cv2.INPAINT_TELEA)


# ---- desktop world (from dashboard mockup) ----
w = i2[70:834, 250:1536].copy()
w = inpaint(w,
            rects=[(487, 186, 743, 245), (107, 378, 370, 440), (940, 402, 1215, 462), (510, 603, 807, 665)],
            text_rects=[(28, 36, 285, 190, 150)])
cv2.imwrite(O + 'world.png', w)

# ---- mobile world (from phone mockup) ----
p = i1[92:512, 1277:1521].copy()
p = inpaint(p, [(72, 50, 165, 79), (36, 160, 129, 190), (78, 298, 181, 328), (71, 377, 172, 407)], grow=4, r=7)
cv2.imwrite(O + 'mobile.png', p)

# ---- district banners (image 1 bottom row) ----
banners = {
    'yourplace': (10, 590, 384, 718, [], [(50, 20, 210, 88, 140)]),
    'mindplace': (395, 590, 768, 702, [(118, 48, 278, 100)], []),
    'marketplace': (778, 590, 1148, 700, [(116, 44, 284, 104)], []),
    'workplace': (1158, 590, 1528, 703, [(112, 46, 262, 100)], []),
}
for k, (x0, y0, x1, y1, rects, tr) in banners.items():
    b = i1[y0:y1, x0:x1].copy()
    b = inpaint(b, rects, tr, grow=6)
    cv2.imwrite(O + f'banner_{k}.png', b)

# ---- place cards (dashboard bottom row, clean art) ----
for k, x0 in zip(['yourplace', 'mindplace', 'marketplace', 'workplace'], [277, 583, 886, 1196]):
    cv2.imwrite(O + f'card_{k}.png', i2[841:918, x0:x0 + 288])

# ---- small content thumbnails from image 1 panels ----
thumbs = {
    'avatar_josie': (i2, 32, 108, 104, 180),
    'avatar_josie2': (i1, 1193, 14, 1232, 53),
    'post_landscape': (i1, 180, 930, 374, 1019),
    'shop_sunsoil': (i1, 795, 800, 880, 866),
    'shop_luna': (i1, 889, 800, 1006, 866),
    'shop_bloom': (i1, 1016, 800, 1129, 866),
    'prod_prints': (i1, 794, 925, 870, 980),
    'prod_hanger': (i1, 880, 925, 956, 980),
    'prod_journal': (i1, 967, 925, 1045, 980),
    'prod_mug': (i1, 1057, 925, 1137, 980),
    'avatar_a': (i1, 416, 896, 444, 924),
    'avatar_b': (i1, 416, 938, 444, 966),
    'avatar_c': (i1, 416, 980, 444, 1008),
    'avatar_d': (i1, 26, 770, 88, 830),
}
BAKED_HEARTS = {'shop_sunsoil', 'prod_prints', 'prod_hanger', 'prod_journal', 'prod_mug'}
for k, (src, x0, y0, x1, y1) in thumbs.items():
    t = src[y0:y1, x0:x1].copy()
    if k in BAKED_HEARTS:  # remove the mockup's save-heart; the UI draws its own
        m = np.zeros(t.shape[:2], np.uint8)
        cv2.circle(m, (t.shape[1] - 11, 10), 8, 255, -1)
        t = cv2.inpaint(t, m, 5, cv2.INPAINT_TELEA)
    cv2.imwrite(O + f'{k}.png', t)
print('ok')
