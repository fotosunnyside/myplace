/**
 * Core domain types for PLACES.
 *
 * The user identity (`PlacesIdentity`) is intentionally structured as a set of
 * per-district "stamps" around one shared core profile, so it can later be
 * promoted to a portable PLACES Passport without changing consumers.
 */

export type DistrictId = 'yourplace' | 'mindplace' | 'marketplace' | 'workplace'

/* ------------------------------------------------------------------ */
/* Identity / Passport                                                  */
/* ------------------------------------------------------------------ */

export interface CoreProfile {
  id: string
  name: string
  username: string
  avatar: string
  bio: string
  location: string
  pronouns?: string
  joinedAt: string
  interests: string[]
  skills: string[]
}

export interface Connections {
  following: number
  followers: number
  friends: number
  communities: string[]
}

export interface Reputation {
  /** Aggregate trust score across all Places, 0–100. */
  score: number
  badges: { id: string; label: string; district: DistrictId }[]
}

export interface SavedItem {
  id: string
  district: DistrictId
  kind: 'post' | 'course' | 'discussion' | 'product' | 'shop' | 'opportunity'
  refId: string
  savedAt: string
}

export interface Collection {
  id: string
  title: string
  cover: string
  itemCount: number
}

/** Per-district activity — each one is a future Passport "stamp". */
export interface LearningActivity {
  coursesInProgress: number
  coursesCompleted: number
  discussionsStarted: number
  helpfulAnswers: number
}

export interface ShopActivity {
  shopName?: string
  listings: number
  purchases: number
  favourites: number
}

export interface ProfessionalActivity {
  headline: string
  openTo: ('jobs' | 'freelance' | 'collaboration')[]
  applications: number
  projects: number
}

export interface PlacesIdentity {
  profile: CoreProfile
  connections: Connections
  reputation: Reputation
  saved: SavedItem[]
  collections: Collection[]
  activity: {
    learning: LearningActivity
    shop: ShopActivity
    professional: ProfessionalActivity
  }
}

/* ------------------------------------------------------------------ */
/* Content                                                              */
/* ------------------------------------------------------------------ */

export interface Author {
  name: string
  username: string
  avatar: string
}

export interface Post {
  id: string
  author: Author
  postedAgo: string
  body: string
  image?: string
  likes: number
  comments: number
  audience: 'friends' | 'following' | 'communities'
}

export interface LearningItem {
  id: string
  title: string
  subtitle: string
  image: string
  members: string
  kind: 'course' | 'guide' | 'live'
}

export interface Discussion {
  id: string
  title: string
  author: Author
  category: string
  categoryTone: 'teal' | 'coral' | 'sun' | 'lavender' | 'leaf'
  comments: number
  postedAgo: string
  upvotes: string
}

export interface Shop {
  id: string
  name: string
  category: string
  image: string
}

export interface Product {
  id: string
  title: string
  price: string
  image: string
  shop: string
}

export interface Opportunity {
  id: string
  title: string
  icon: 'leaf' | 'sun' | 'waves' | 'gem' | 'megaphone' | 'palette'
  iconTone: 'teal' | 'sun' | 'sky' | 'leaf' | 'coral' | 'lavender'
  location: string
  type: string
  tags: string[]
  pay: string
}
