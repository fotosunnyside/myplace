import type { DistrictId } from '@/lib/types'

/**
 * World-space coordinate system.
 *
 * Every artwork layer is authored against one canvas of WORLD.width × WORLD.height
 * units (assets are exported at 2× for retina). Hotspots, labels and layers are all
 * expressed in these units and converted to percentages at render time, so the art
 * can be swapped for higher-fidelity illustration without touching the UI — as long
 * as the new art keeps the same canvas proportions (or this file is updated).
 */
export const WORLD = { width: 1286, height: 764 } as const

/** Mobile world is a separate, vertical composition. */
export const MOBILE_WORLD = { width: 244, height: 420 } as const

export type Rect = { x: number; y: number; w: number; h: number }
export type Point = [number, number]

export interface DistrictConfig {
  id: DistrictId
  name: string
  href: `/${DistrictId}`
  /** Short caps line on world labels. */
  labelTagline: string
  /** Sentence-style subtitle on banners. */
  subtitle: string
  description: string
  /** Lucide icon key (resolved in components/world/icons). */
  icon: 'house' | 'graduation-cap' | 'store' | 'briefcase'
  art: {
    banner: string
    /** Native aspect ratio of the banner art (w / h). */
    bannerAspect: number
    /**
     * Where the title card sits on the banner, in % of the banner. It covers the
     * title plate area reserved in the art. `align: 'left'` renders text on a haze.
     */
    bannerTitle: { left: number; top: number; width: number; height: number; align: 'center' | 'left' }
    card: string
    /** Cut-out layer (transparent) used for hover highlight. */
    layer: { src: string; rect: Rect }
  }
  world: {
    /** Clickable region. */
    hotspot: Point[]
    /** Area the floating label must cover (and where it sits). */
    label: Rect
  }
  mobile: {
    label: Rect
    /** Vertical band of the mobile world that belongs to this district. */
    band: { y: number; h: number }
  }
  /** Teaser for the "Continue in…" cards. */
  teaser: { verb: string; line: string }
}

const layer = (id: DistrictId, rect: Rect) => ({ src: `/world/${id}.webp`, rect })

/**
 * Keep in sync with tools/build-assets.py (layer rects are generated from the
 * same hotspot polygons there, and printed by that script).
 */
export const DISTRICTS: DistrictConfig[] = [
  {
    id: 'yourplace',
    name: 'YourPlace',
    href: '/yourplace',
    labelTagline: 'Your profile · Social · Personal AI',
    subtitle: 'Your home in PLACES.',
    description: 'Your identity, your people and your personal AI — all in one cozy home.',
    icon: 'house',
    art: {
      banner: '/districts/yourplace-banner.webp',
      bannerAspect: 1496 / 512,
      bannerTitle: { left: 9, top: 12, width: 50, height: 60, align: 'left' },
      card: '/districts/yourplace-card.webp',
      layer: layer('yourplace', { x: 39, y: 234, w: 447, h: 342 }),
    },
    world: {
      hotspot: [[55, 470], [60, 380], [110, 300], [175, 255], [300, 250], [390, 280], [450, 330], [470, 400], [430, 440], [380, 500], [300, 545], [240, 560], [130, 550]],
      label: { x: 107, y: 378, w: 263, h: 62 },
    },
    mobile: { label: { x: 36, y: 160, w: 93, h: 30 }, band: { y: 120, h: 120 } },
    teaser: { verb: 'Continue in', line: '2 new messages · 3 recent posts' },
  },
  {
    id: 'mindplace',
    name: 'MindPlace',
    href: '/mindplace',
    labelTagline: 'Learn · Discuss · Grow',
    subtitle: 'Learn. Discuss. Grow.',
    description: 'Courses, guides, experts and conversations that help you grow.',
    icon: 'graduation-cap',
    art: {
      banner: '/districts/mindplace-banner.webp',
      bannerAspect: 1492 / 448,
      bannerTitle: { left: 29, top: 34, width: 48, height: 63, align: 'center' },
      card: '/districts/mindplace-card.webp',
      layer: layer('mindplace', { x: 394, y: 12, w: 527, h: 404 }),
    },
    world: {
      hotspot: [[430, 300], [410, 230], [455, 150], [530, 70], [600, 28], [680, 40], [740, 80], [830, 120], [900, 170], [905, 260], [850, 300], [760, 330], [700, 400], [640, 395], [560, 340], [480, 330]],
      label: { x: 487, y: 186, w: 256, h: 59 },
    },
    mobile: { label: { x: 72, y: 50, w: 93, h: 29 }, band: { y: 0, h: 120 } },
    teaser: { verb: 'Discover in', line: 'Trending: Sustainable Living' },
  },
  {
    id: 'marketplace',
    name: 'MarketPlace',
    href: '/marketplace',
    labelTagline: 'Shop · Sell · Discover',
    subtitle: 'Shop. Sell. Discover.',
    description: 'Independent shops, makers and creators — wander, discover and support.',
    icon: 'store',
    art: {
      banner: '/districts/marketplace-banner.webp',
      bannerAspect: 1480 / 440,
      bannerTitle: { left: 28.5, top: 32, width: 51, height: 66, align: 'center' },
      card: '/districts/marketplace-card.webp',
      layer: layer('marketplace', { x: 329, y: 394, w: 647, h: 370 }),
    },
    world: {
      hotspot: [[405, 470], [500, 425], [600, 410], [700, 420], [790, 440], [880, 480], [960, 560], [945, 650], [870, 730], [740, 764], [520, 764], [400, 720], [345, 650], [370, 560]],
      label: { x: 510, y: 603, w: 297, h: 62 },
    },
    mobile: { label: { x: 78, y: 298, w: 103, h: 30 }, band: { y: 240, h: 110 } },
    teaser: { verb: 'Explore in', line: 'New handmade shops' },
  },
  {
    id: 'workplace',
    name: 'WorkPlace',
    href: '/workplace',
    labelTagline: 'Jobs · Services · Teams',
    subtitle: 'Jobs. Services. Teams.',
    description: 'Meaningful work, trusted services and teams that feel human.',
    icon: 'briefcase',
    art: {
      banner: '/districts/workplace-banner.webp',
      bannerAspect: 1480 / 452,
      bannerTitle: { left: 27.5, top: 32, width: 46, height: 64, align: 'center' },
      card: '/districts/workplace-card.webp',
      layer: layer('workplace', { x: 854, y: 154, w: 432, h: 442 }),
    },
    world: {
      hotspot: [[900, 310], [935, 240], [960, 185], [1100, 170], [1230, 190], [1286, 250], [1286, 500], [1230, 570], [1100, 580], [990, 520], [930, 470], [870, 420]],
      label: { x: 940, y: 402, w: 275, h: 60 },
    },
    mobile: { label: { x: 71, y: 377, w: 101, h: 30 }, band: { y: 350, h: 70 } },
    teaser: { verb: 'Opportunities in', line: '12 new remote jobs' },
  },
]

export const DISTRICT_ORDER: DistrictId[] = ['yourplace', 'mindplace', 'marketplace', 'workplace']

export const getDistrict = (id: DistrictId) => DISTRICTS.find((d) => d.id === id)!

export const orderedDistricts = () => DISTRICT_ORDER.map(getDistrict)

/* ------------------------------------------------------------------ */
/* Ambient layers                                                       */
/* ------------------------------------------------------------------ */

export const AMBIENT = {
  balloon: { src: '/world/balloon.webp', rect: { x: 1034, y: 30, w: 102, h: 126 } satisfies Rect },
  /** Points on the water that gently glint. */
  glints: [
    [40, 330], [120, 612], [300, 560], [560, 405], [1000, 610], [1180, 668], [85, 468],
    [905, 668], [640, 384], [1060, 640], [1240, 560], [180, 690],
  ] as Point[],
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

type Space = { width: number; height: number }

export const pctRect = (r: Rect, s: Space = WORLD) => ({
  left: `${(r.x / s.width) * 100}%`,
  top: `${(r.y / s.height) * 100}%`,
  width: `${(r.w / s.width) * 100}%`,
  height: `${(r.h / s.height) * 100}%`,
})

export const polygonPoints = (pts: Point[]) => pts.map(([x, y]) => `${x},${y}`).join(' ')
