# PLACES — The internet, made into a world.

*The Conscious Web.* PLACES organizes social, learning, shopping and work into four connected districts of one illustrated world:

| Place | Route | What lives there |
| --- | --- | --- |
| **YourPlace** | `/yourplace` | Profile, posts, friends, collections, saved, personal AI |
| **MindPlace** | `/mindplace` | Courses, guides, discussions, experts, live sessions |
| **MarketPlace** | `/marketplace` | Independent shops, products, creators |
| **WorkPlace** | `/workplace` | Jobs, freelance, services, teams |

One person · one identity · four Places · one connected world.

## Live site (GitHub Pages)

**https://fotosunnyside.github.io/myplace/**

`.github/workflows/pages.yml` runs lint, typecheck, unit tests, the static build and the Playwright journeys on every push, and deploys only
when everything passes. Optional: set the repository variable `PLAUSIBLE_DOMAIN` to turn on cookie-free analytics.

## What works today

Everything below is real, saved, and works on the live GitHub Pages site:

- **Accounts:** join (photo, username, interests), sign in and out, edit profile and work profile, download your data, delete your account.
- **YourPlace:** posts with photos, links, locations and polls; likes, comments, deleting your posts; following people; Saved; Collections;
  and a built-in assistant that summarizes your day, recommends things and searches your world.
- **MindPlace:** courses and guides with lessons, enrollment and progress tracking, completion notifications, discussions with replies and
  upvotes, experts, and live sessions.
- **MarketPlace:** open a shop, list products with photos, buy with **Stripe Payment Links** (buyers pay the seller directly) or place a test
  order, message sellers, favourites.
- **WorkPlace:** browse and filter opportunities, apply with a note and a link, post opportunities, and see who applied.
- **Messages, notifications, search:** one inbox across Places, a notification center, and search across people, courses, discussions,
  shops, products, jobs and posts.
- **Activity:** your orders, applications, learning progress, sales and applicants in one place.

### Local-first for now

GitHub Pages only serves static files, so PLACES keeps each person's world **in their browser (IndexedDB)**. Data survives reloads and syncs
across tabs, but it isn't shared between people or devices. All reads and writes go through `lib/store/`: pure actions in
`actions.ts`, persistence in `store.ts`. Moving to a cloud backend (for example Supabase for auth, database, storage and realtime messages,
plus a Stripe webhook) replaces that layer without touching the UI.

### Selling with Stripe

1. In the Stripe Dashboard → **Payment Links**, create a link for your product.
2. Under **After payment**, choose "Don't show confirmation page" and redirect to the confirmation URL shown on your product page in
   PLACES (`…/marketplace/product/?id=<id>&paid=1`).
3. Paste the Payment Link into the listing (when you create it, or later on the product page).

Buyers pay you directly on Stripe's checkout. When they return, PLACES records the order in their Activity. Stripe's dashboard is the
source of truth for payments: without a server, PLACES can't independently verify a payment.

### Creator plan: host courses for $2/month

Anyone with an active creator plan can publish courses in MindPlace (`/teach`), free or paid. Paid courses show the first lesson as a
free preview. Learners buy through the **creator's own Stripe Payment Link**, so creators keep 100% of course sales.

To charge for the plan:
1. In Stripe, create a product "PLACES Creator plan" with a **recurring $2/month** price, then create a **Payment Link** for it.
2. In the Payment Link's **After payment** settings, redirect to `https://fotosunnyside.github.io/myplace/teach/?subscribed=1`.
3. Optional: in Stripe → **Settings → Billing → Customer portal**, turn on the portal and copy its login link, so creators can manage
   or cancel their plan.
4. In GitHub → repository **Settings → Secrets and variables → Actions → Variables**, add `CREATOR_PLAN_LINK` (the Payment Link) and,
   optionally, `STRIPE_PORTAL_LINK`. The next deploy picks them up.

Until `CREATOR_PLAN_LINK` is set, plans start in clearly labelled test mode. Without a backend, PLACES trusts the return from Stripe
and can't see renewals or cancellations. Connecting the cloud backend adds a Stripe webhook that keeps plan status in sync.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Framer Motion · Lucide · idb-keyval · Vitest · Playwright.

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests (store actions)
npm run build:pages  # static export for GitHub Pages → out/
npm run test:e2e     # Playwright journeys against out/ (desktop + phone)
npm run lint && npm run typecheck
```

## Structure

```
app/                     routes: districts + detail pages (course, discussion, product, shop, opportunity), messages,
                         notifications, search, people, activity, settings, privacy, terms
components/
  world/                 PlacesWorld (desktop/tablet), MobileWorld, DistrictLabel, ambient layers, fly-in transition
  districts/             DistrictBanner, preview panels, DistrictPage shell, PlaceCards, apps/ (one per district)
  layout/                SiteHeader, MobileTopBar / MobileTabBar / CreateSheet, HomeHero, MobileHome
  cards/ profile/ search/ ui/ brand/
lib/
  types.ts               domain types, incl. PlacesIdentity (the future PLACES Passport)
  store/                 local-first world: seed, pure actions, selectors, IndexedDB persistence, React hooks
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

The illustrations are placeholders cut from the design mockups (text removed, upscaled 4×). **[docs/ARTWORK.md](docs/ARTWORK.md)** has the
style block, a prompt and size for every asset, and the label spots to keep clear. Generate the final art with it, put the PNGs in a folder
and run `python3 tools/build-assets.py <folder> .`, which builds the layers, responsive sizes and sprites. Then push.

## Identity → PLACES Passport

One `Account` (`lib/types.ts`) owns everything a person creates in every Place: posts, enrollments, shop, orders, applications and
messages. The "Across PLACES" card on the profile already summarizes it, and it is the basis for a future portable PLACES Passport.

## Toward iOS

The web app is built to be wrapped (e.g. Capacitor) or ported:

- `viewport-fit=cover`, safe-area insets on the top bar, tab bar and pages
- web manifest, apple-touch icon, standalone display
- touch-sized targets, a bottom sheet for Create, no hover-only interactions on phones
- data, world configuration and presentation are kept separate, so a native client can reuse `lib/`
