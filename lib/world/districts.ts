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
      bannerAspect: 2000 / 667,
      bannerTitle: { left: 5, top: 14, width: 46, height: 56, align: 'left' },
      card: '/districts/yourplace-card.webp',
      layer: layer('yourplace', { x: 24, y: 189, w: 432, h: 347 }),
    },
    world: {
      hotspot: [[40, 420], [60, 330], [110, 260], [175, 210], [300, 205], [400, 240], [440, 300], [440, 380], [400, 440], [330, 500], [240, 520], [130, 500]],
      label: { x: 120, y: 340, w: 260, h: 58 },
    },
    mobile: { label: { x: 40, y: 128, w: 95, h: 28 }, band: { y: 95, h: 70 } },
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
      bannerAspect: 2000 / 667,
      bannerTitle: { left: 28, top: 10, width: 44, height: 46, align: 'center' },
      card: '/districts/mindplace-card.webp',
      layer: layer('mindplace', { x: 399, y: 0, w: 527, h: 386 }),
    },
    world: {
      hotspot: [[430, 300], [415, 210], [470, 130], [560, 60], [600, 15], [700, 15], [790, 60], [870, 110], [910, 180], [900, 250], [840, 300], [760, 320], [700, 370], [640, 360], [560, 330], [480, 320]],
      label: { x: 520, y: 190, w: 260, h: 58 },
    },
    mobile: { label: { x: 95, y: 62, w: 93, h: 28 }, band: { y: 0, h: 95 } },
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
      bannerAspect: 2000 / 667,
      bannerTitle: { left: 28, top: 10, width: 44, height: 46, align: 'center' },
      card: '/districts/marketplace-card.webp',
      layer: layer('marketplace', { x: 344, y: 364, w: 682, h: 372 }),
    },
    world: {
      hotspot: [[400, 470], [470, 420], [580, 380], [700, 380], [800, 395], [880, 440], [950, 520], [1010, 610], [960, 680], [820, 720], [600, 720], [430, 690], [360, 610], [370, 530]],
      label: { x: 515, y: 578, w: 290, h: 60 },
    },
    mobile: { label: { x: 80, y: 232, w: 103, h: 28 }, band: { y: 165, h: 105 } },
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
      layer: layer('workplace', { x: 844, y: 134, w: 442, h: 402 }),
    },
    world: {
      hotspot: [[880, 300], [920, 230], [960, 175], [1100, 150], [1230, 180], [1286, 240], [1286, 470], [1200, 520], [1080, 520], [990, 470], [920, 430], [860, 380]],
      label: { x: 940, y: 358, w: 270, h: 58 },
    },
    mobile: { label: { x: 125, y: 338, w: 101, h: 28 }, band: { y: 270, h: 150 } },
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
  balloon: { src: '/world/balloon.webp', rect: { x: 1045, y: 8, w: 90, h: 114 } satisfies Rect },
  /** Points on the water that gently glint. */
  glints: [
    [40, 330], [120, 600], [330, 610], [600, 360], [1000, 625], [1180, 660], [80, 470],
    [900, 705], [640, 340], [1050, 560], [30, 160], [300, 720],
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
