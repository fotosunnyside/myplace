"""Social preview image (1200x630) for link sharing. Usage: python3 tools/og-image.py"""
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1200, 630
CREAM, NAVY, SOFT = (255, 249, 239), (18, 59, 74), (61, 95, 108)
serif = lambda s: ImageFont.truetype('tools/fonts/Newsreader-SemiBold.ttf', s)
sans = lambda s: ImageFont.truetype('tools/fonts/DMSans-Medium.ttf', s)

world = Image.open('public/world/world-base.webp').convert('RGB')
scale = 0.66  # world units -> px
ww, wh = round(1286 * scale), round(764 * scale)
X0, Y0 = W - ww, H - wh
img = Image.new('RGB', (W, H), CREAM)
img.paste(world.resize((ww, wh), Image.LANCZOS), (X0, Y0))

# soft cream fades: from the left (under the headline) and along the top edge
fade = Image.new('L', (W, H), 0)
fade.paste(255, (0, 0, 430, H))
fade.paste(Image.linear_gradient('L').rotate(-90).resize((200, H)), (430, 0))
top = Image.linear_gradient('L').rotate(180).resize((W, 110))  # 255 at top -> 0
fade.paste(Image.composite(Image.new('L', (W, 110), 255), fade.crop((0, Y0, W, Y0 + 110)), top), (0, Y0))
fade.paste(255, (0, 0, W, Y0))
img = Image.composite(Image.new('RGB', (W, H), CREAM), img, fade)

# district labels over the plates reserved in the art (same as the site)
lab = ImageDraw.Draw(img)
for name, tag, (x, y, w, h) in [
    ('MindPlace', 'LEARN · DISCUSS · GROW', (487, 186, 256, 59)),
    ('YourPlace', 'YOUR PROFILE · SOCIAL · AI', (107, 378, 263, 62)),
    ('WorkPlace', 'JOBS · SERVICES · TEAMS', (940, 402, 275, 60)),
    ('MarketPlace', 'SHOP · SELL · DISCOVER', (510, 603, 297, 62)),
]:
    x0, y0 = X0 + (x - 9) * scale, Y0 + (y - 9) * scale
    x1, y1 = X0 + (x + w + 9) * scale, Y0 + (y + h + 9) * scale
    lab.rounded_rectangle((x0 + 1, y0 + 4, x1 + 1, y1 + 4), 13, fill=(206, 200, 186))
    lab.rounded_rectangle((x0, y0, x1, y1), 13, fill=(255, 250, 241), outline=(255, 255, 255), width=2)
    cx = (x0 + x1) / 2
    lab.text((cx, y0 + (y1 - y0) * 0.42), name, font=serif(22), fill=NAVY, anchor='mm')
    lab.text((cx, y0 + (y1 - y0) * 0.77), tag, font=sans(8), fill=SOFT, anchor='mm')

d = ImageDraw.Draw(img)
k, ox, oy = 1.9, 64, 52
P = lambda pts: [(ox + x * k, oy + y * k) for x, y in pts]
d.polygon(P([(3, 15), (20, 3), (20, 22)]), fill='#58C8C6')
d.polygon(P([(37, 15), (20, 3), (20, 22)]), fill='#12AAA8')
d.polygon(P([(3, 15), (20, 22), (20, 38)]), fill='#5E9E68')
d.polygon(P([(37, 15), (20, 22), (20, 38)]), fill='#23485A')

d.text((64, 150), 'PLACES', font=serif(104), fill=NAVY)
d.text((66, 268), 'The internet,', font=serif(44), fill=NAVY)
d.text((66, 316), 'made into a world.', font=serif(44), fill=NAVY)
d.text((68, 520), 'T H E   C O N S C I O U S   W E B', font=sans(18), fill=SOFT)
img.save('app/opengraph-image.png', optimize=True)
img.save('app/twitter-image.png', optimize=True)
print('ok')
