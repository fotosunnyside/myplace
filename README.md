# PLACES — The internet, made into a world.

*The Conscious Web.* PLACES organizes social, learning, shopping and work into four connected districts of one illustrated world:

| Place | Route | What lives there |
| --- | --- | --- |
| **YourPlace** | `/yourplace` | Profile, posts, friends, collections, saved, personal AI |
| **MindPlace** | `/mindplace` | Courses, guides, discussions, experts, live sessions |
| **MarketPlace** | `/marketplace` | Independent shops, products, creators |
| **WorkPlace** | `/workplace` | Jobs, freelance, services, teams |

One person · one identity · four Places · one connected world.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide icons.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run lint
npm run typecheck
```

## Structure

```
app/                     routes: /, /yourplace, /mindplace, /marketplace, /workplace, /explore, /messages
components/
  world/                 PlacesWorld (desktop/tablet), MobileWorld, DistrictLabel, ambient layers, fly-in transition
  districts/             DistrictBanner, preview panels, DistrictPage shell, PlaceCards, apps/ (one per district)
  layout/                SiteHeader, MobileTopBar / MobileTabBar / CreateSheet, HomeHero, MobileHome
  cards/ profile/ search/ ui/ brand/
lib/
  types.ts               domain types, incl. PlacesIdentity (the future PLACES Passport)
  data/                  mock identity + content — swap for API calls later
  world/districts.ts     world coordinate system, hotspots, label plates, layer rects, banner title positions
public/world/            world-base, per-district layers, balloon, clouds, foreground, mobile-world
public/districts/        district banners and "Continue in…" card art
tools/                   asset pipeline (Python) — see below
```

### The world is layered, not baked

`PlacesWorld` stacks independent layers inside a fixed-aspect stage (`1286 × 764` world units):

1. `world-base.webp`: the landscape
2. `yourplace|mindplace|marketplace|workplace.webp`: feathered cut-outs, brightened and glowing on hover
3. ambient sprites: the drifting balloon, water glints, drifting clouds, corner cloud banks
4. invisible SVG hotspot polygons (click → fly-in transition → route)
5. HTML labels, sized in container-query units so they scale with the art

Everything is positioned from `lib/world/districts.ts`, so artwork can be replaced without touching components. The labels also cover
the "label plates" reserved in the art.

Motion is subtle and switches off under `prefers-reduced-motion`.

### Responsive

- **Desktop (lg+)**: editorial column beside the world, which bleeds under a translucent header; four district preview panels below.
- **Tablet (md)**: compact editorial band above a full-width world; preview panels in a 2 × 2 grid.
- **Phone**: native-style shell (centered logo, search, avatar, bottom tabs with a teal Create button, safe-area padding) and a
  separate vertical world composition.

District interfaces use container queries, so the same component renders as the miniature preview on the home page and as the full page.

## Artwork (placeholder → final)

The art in `public/` is **placeholder** art. It was cut from the design mockups, the baked-in UI text was inpainted out, and it was
upscaled 4× (Real-ESRGAN). Replace it with commissioned illustration before launch:

```bash
python3 tools/prep.py mockup-landing.webp mockup-dashboard.webp work/src     # crop + inpaint (only for the mockup placeholders)
SR_WEIGHTS=weights/ python3 tools/sr.py plus work/src work/up                # optional 4x upscale
python3 tools/build-assets.py work/up .                                      # compose layers → public/
```

For final art, put `world.png` (any multiple of 1286 × 764), `mobile.png`, `banner_*.png`, `card_*.png` and so on in `work/up`, then run
`build-assets.py`. If the composition changes, update the hotspots, label plates and layer rects in `lib/world/districts.ts`. The script
prints the layer rects.

## Identity → PLACES Passport

`PlacesIdentity` (`lib/types.ts`) is one core profile with connections, reputation, saved items and collections. Per-district
activity (learning, shop, professional) is structured as future Passport "stamps". Every district reads from the same `currentUser`,
so a backend identity service can replace `lib/data/identity.ts` without changing the UI.

## Toward iOS

The web app is built to be wrapped (e.g. Capacitor) or ported:

- `viewport-fit=cover`, safe-area insets on the top bar, tab bar and pages
- web manifest, apple-touch icon, standalone display
- touch-sized targets, a bottom sheet for Create, no hover-only interactions on phones
- data, world configuration and presentation are kept separate, so a native client can reuse `lib/`
