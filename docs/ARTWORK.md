# PLACES artwork brief

The illustrations on the site today are **placeholders**. They were cut from the two design mockups, cleaned up and upscaled 4×. They
match the style exactly, but they come from ~1500px mockups, so close-ups (product photos, course covers, the phone world) are soft. This
brief is for generating the final art in the same image tool that produced the mockups, then dropping it into the site.

## 1. Style (paste this at the start of every prompt)

> Premium miniature storybook world, isometric 3/4 aerial view, hand-painted digital illustration with soft 3D depth. Warm afternoon sun
> from the upper left, gentle long shadows, luminous turquoise water, lush greenery, flowering trees in pink and coral, cream and
> terracotta architecture, tiny people going about their day. Optimistic, calm, welcoming, sophisticated, slightly magical. Palette:
> deep navy #123B4A accents, teal #12AAA8, aqua #58C8C6, warm cream #FFF9EF, sky #BFE7F4, leaf green #5E9E68, sun yellow #F7C75E, soft
> coral #EF927E, soft lavender #B8A6D9. Highly detailed, crisp, clean edges. Not cyberpunk, not sci-fi, not childish, not flat.
> **No text, no letters, no labels, no signs, no logos, no UI, no watermark.**

The last line matters: the site draws its own labels. Any text baked into the art has to be painted out afterwards.

## 2. Assets

Save each file under the name shown, as PNG, at the size shown or larger with the same aspect ratio. Put them all in one folder (for
example `art/`).

### The world (most important)

| File | Size | Prompt (after the style block) |
| --- | --- | --- |
| `world.png` | **3858 × 2292** (aspect 1286:764) | One connected island world seen from above, four districts linked by stone bridges, paths, waterfalls and rivers, surrounded by turquoise sea, mountains and soft clouds on the horizon. **Upper centre:** a classical domed academy with columns, terraced gardens, libraries, reading lawns and waterfalls (MindPlace). **Left / lower left:** a charming cottage neighbourhood with a cream house, red roof, garden chairs, a pink blossom tree and warm window lights (YourPlace). **Lower centre:** a colourful pedestrian market village with striped awnings, café tables, a round fountain plaza, flower stalls and strolling people (MarketPlace). **Right:** a contemporary district of glass-and-wood buildings, rooftop terraces, coworking cafés under white umbrellas and people collaborating outdoors (WorkPlace). Sailboats and a small ferry on the water, a striped hot-air balloon upper right, a beach lower right. Leave calm, uncluttered areas (sky, lawn or water) at the four label spots listed below. |
| `mobile.png` | **1464 × 2520** (aspect 244:420) | The same world rearranged as a tall vertical composition for a phone, top to bottom: the domed academy on a hilltop (MindPlace) → the cottage neighbourhood (YourPlace) → the fountain market village (MarketPlace) → the glass work district by the beach (WorkPlace). Bridges and paths lead the eye downwards. Calm areas at the four label spots listed below. |

**Label spots.** The site places floating labels on these areas. Keep them free of important detail. Positions are fractions of the
image (left, top, width, height):

| District | Desktop `world.png` | Phone `mobile.png` |
| --- | --- | --- |
| MindPlace | 0.38, 0.24, 0.20, 0.08 | 0.30, 0.12, 0.38, 0.07 |
| YourPlace | 0.08, 0.49, 0.20, 0.08 | 0.15, 0.38, 0.38, 0.07 |
| MarketPlace | 0.40, 0.79, 0.23, 0.08 | 0.32, 0.71, 0.42, 0.07 |
| WorkPlace | 0.73, 0.53, 0.21, 0.08 | 0.29, 0.90, 0.41, 0.07 |

If the new art puts districts somewhere else, that's fine: send it over, and the hotspots and labels in `lib/world/districts.ts` get
re-mapped to the new layout.

### District banners and cards

| File | Size | Prompt |
| --- | --- | --- |
| `banner_yourplace.png` | 2400 × 820 | Close eye-level view of a cosy cream cottage with a red-brown roof, garden terrace with rattan and yellow armchairs, potted plants, a pink sky over the sea on the left. Keep the left 45% calm and softly lit (a title sits there). |
| `banner_mindplace.png` | 2400 × 720 | A sunny learning campus: a domed academy in the background, cypress trees, a lavender-roofed library, people reading and talking on a lawn, a blossom tree on the right. Keep the centre (30–78% horizontally) calm for a title card. |
| `banner_marketplace.png` | 2400 × 720 | A colourful pedestrian shopping street in warm golden light: striped awnings, boutique windows, flower buckets, café tables, shoppers. Keep the centre calm for a title card. |
| `banner_workplace.png` | 2400 × 730 | A modern, human business district: glass buildings, trees, people collaborating at outdoor tables under white and blue umbrellas. Keep the centre calm for a title card. |
| `card_yourplace.png` | 1152 × 308 | Cosy living room with a sofa, lamps and plants, a garden visible through the window. |
| `card_mindplace.png` | 1152 × 308 | A warm library café with people studying at long tables and laptops. |
| `card_marketplace.png` | 1152 × 308 | Inside a bright maker's market with ceramics, textiles and a striped awning. |
| `card_workplace.png` | 1152 × 308 | A garden coworking terrace with people working at tables under umbrellas. |

### Course covers (4:3, 1600 × 1200)

`learn_sustainable.png`: a sunny kitchen garden with compost bins and a bicycle.
`learn_digital.png`: a person working on a laptop at a café table, with warm light.
`learn_health.png`: a morning walk on a coastal path.
`learn_writing.png`: a notebook and tea by a window with blossom outside.
`learn_garden.png`: a balcony with herbs, tomatoes and terracotta pots.
`learn_shop.png`: a small maker's studio with products on shelves.

### Shops and products (soft product photography in the same palette, 1600 × 1200)

`shop_sunsoil.png` (plants and pots), `shop_luna.png` (ceramics and macramé), `shop_bloom.png` (prints and planners on a desk),
`prod_prints.png`, `prod_hanger.png`, `prod_journal.png`, `prod_mug.png`, `post_landscape.png` (a coastal garden at sunset).

For product photos, use this style block instead: "soft natural-light product photography, pastel peach and cream backdrop, gentle
shadows, calm and premium, no text".

### People (square, 1024 × 1024)

`avatar_josie.png`, `avatar_a.png`, `avatar_b.png`, `avatar_c.png`: friendly, natural portraits in soft daylight. Use people you have
the rights to, or generated portraits.

## 3. Putting it on the site

```bash
# 1. put the PNGs in a folder, e.g. art/
# 2. optional: upscale small images 4x (needs the Real-ESRGAN weights, see tools/README.md)
SR_WEIGHTS=weights/ python3 tools/sr.py plus art art-up
# 3. build every web asset (layers, responsive sizes, balloon sprite, clouds…)
python3 tools/build-assets.py art-up .     # or: python3 tools/build-assets.py art .
python3 tools/og-image.py                  # refresh the social preview image
```

Push to the branch and the site rebuilds and redeploys. If the world layout changed, update the hotspot polygons and label rectangles in
`lib/world/districts.ts` (also listed in `tools/build-assets.py`). `build-assets.py` prints the new layer rectangles. The balloon
sprite position is in `BALLOON` in the same script.
