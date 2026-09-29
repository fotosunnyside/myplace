/**
 * Core domain types for PLACES.
 *
 * One `Account` (the signed-in person) travels across every Place. Everything a person
 * creates references them by id, so the same identity shows up in YourPlace, MindPlace,
 * MarketPlace and WorkPlace — the foundation for a future PLACES Passport.
 */

export type ID = string
export type DistrictId = 'yourplace' | 'mindplace' | 'marketplace' | 'workplace'
export type Tone = 'teal' | 'coral' | 'sun' | 'lavender' | 'leaf' | 'sky' | 'neutral'

/* ------------------------------------------------------------------ */
/* People & identity                                                    */
/* ------------------------------------------------------------------ */

export interface Person {
  id: ID
  name: string
  username: string
  avatar: string
  bio: string
  location: string
  headline: string
  interests: string[]
  skills: string[]
  joinedAt: number
  /** Seeded counts for people who exist before this device did. */
  baseFollowers?: number
  baseFollowing?: number
  /** A member with a PLACES account (false for PLACES community profiles like the guide). */
  member?: boolean
  /** Paid plans: Create in MindPlace, Host a Space, PLACES Pass. */
  plans?: Partial<Record<PlanKind, MemberPlan>>
  /** @deprecated The old creator plan, kept only so on-device worlds saved before PLACES Pass still read. */
  creatorPlan?: CreatorPlan
}

export type PlanKind = 'create' | 'host' | 'pass'

export interface MemberPlan {
  status: 'active' | 'canceled'
  via: 'stripe' | 'test'
  since: number
  /** End of the current paid period. */
  renewsAt: number
  /** Create is per published course or membership: how many this plan covers. */
  quantity: number
}

export interface Account extends Person {
  email: string
  openTo: ('jobs' | 'freelance' | 'collaboration')[]
}

export interface CreatorPlan {
  status: 'active' | 'canceled'
  via: 'stripe' | 'test'
  since: number
  /** End of the current paid period. */
  renewsAt: number
}

/* ------------------------------------------------------------------ */
/* YourPlace                                                            */
/* ------------------------------------------------------------------ */

export interface Comment {
  id: ID
  authorId: ID
  body: string
  createdAt: number
}

export interface PollOption {
  id: ID
  label: string
  votes: ID[]
}

export interface Post {
  id: ID
  authorId: ID
  body: string
  image?: string
  link?: string
  location?: string
  poll?: PollOption[]
  audience: 'public' | 'friends'
  createdAt: number
  likes: ID[]
  baseLikes?: number
  comments: Comment[]
  baseComments?: number
}

/* ------------------------------------------------------------------ */
/* MindPlace                                                            */
/* ------------------------------------------------------------------ */

export interface Lesson {
  id: ID
  title: string
  minutes: number
  body: string
}

export interface Course {
  id: ID
  title: string
  subtitle: string
  description: string
  image: string
  kind: 'course' | 'guide' | 'live'
  topic: string
  expertId: ID
  lessons: Lesson[]
  baseMembers: number
  /** For live sessions. */
  startsAt?: number
  /** In cents. 0 or missing = free. */
  price?: number
  /** Paid courses: a one-time enrollment, or a recurring monthly membership. */
  billing?: 'once' | 'monthly'
  /** Creator's own Stripe Payment Link — learners pay the creator directly. */
  stripeLink?: string
  createdAt?: number
}

export interface CoursePurchase {
  id: ID
  courseId: ID
  buyerId: ID
  total: number
  /** PLACES platform fee in cents (5% without PLACES Pass). */
  fee?: number
  via: 'stripe' | 'test'
  createdAt: number
}

export interface Enrollment {
  courseId: ID
  startedAt: number
  completed: ID[]
}

export interface Discussion {
  id: ID
  title: string
  body: string
  authorId: ID
  category: string
  tone: Tone
  createdAt: number
  upvoters: ID[]
  baseUpvotes?: number
  replies: Comment[]
  baseReplies?: number
}

/* ------------------------------------------------------------------ */
/* MarketPlace                                                          */
/* ------------------------------------------------------------------ */

export interface Shop {
  id: ID
  name: string
  category: string
  description: string
  image: string
  ownerId: ID
  createdAt: number
}

export interface Product {
  id: ID
  shopId: ID
  title: string
  description: string
  /** In cents. */
  price: number
  image: string
  category: 'Handmade' | 'Digital' | 'Home' | 'Wellness' | 'Services'
  /** Seller's own Stripe Payment Link — buyers pay the seller directly. */
  stripeLink?: string
  /** Physical item shipped by the seller (carries the PLACES sales admin fee). */
  ships?: boolean
  createdAt: number
}

export interface Order {
  id: ID
  productId: ID
  buyerId: ID
  total: number
  /** PLACES sales admin fee in cents (1% on shipped items). */
  fee?: number
  via: 'stripe' | 'test'
  createdAt: number
}

/* ------------------------------------------------------------------ */
/* WorkPlace                                                            */
/* ------------------------------------------------------------------ */

export type OpportunityIcon = 'leaf' | 'sun' | 'waves' | 'gem' | 'megaphone' | 'palette' | 'briefcase'

export interface Opportunity {
  id: ID
  title: string
  org: string
  postedById: ID
  icon: OpportunityIcon
  iconTone: Tone
  location: string
  type: 'Full Time' | 'Part Time' | 'Flexible' | 'Project' | 'Freelance'
  kind: 'job' | 'service' | 'project' | 'team'
  tags: string[]
  pay: string
  description: string
  createdAt: number
  /** How the job-post fee was paid (missing for seeded posts). */
  paidVia?: 'stripe' | 'test' | 'pass'
}

export interface Application {
  id: ID
  opportunityId: ID
  applicantId: ID
  message: string
  link?: string
  createdAt: number
}

/* ------------------------------------------------------------------ */
/* Shared                                                               */
/* ------------------------------------------------------------------ */

export interface Message {
  id: ID
  senderId: ID
  body: string
  createdAt: number
}

export interface Thread {
  id: ID
  participantIds: ID[]
  messages: Message[]
  /** What the conversation is about, e.g. a product or opportunity. */
  context?: { kind: RefKind; refId: ID; label: string }
  readAt: number
}

export type RefKind = 'post' | 'course' | 'discussion' | 'product' | 'shop' | 'opportunity'

export interface Ref {
  kind: RefKind
  refId: ID
}

export interface SavedItem extends Ref {
  savedAt: number
}

export interface Collection {
  id: ID
  title: string
  items: Ref[]
  createdAt: number
}

export interface Notification {
  id: ID
  text: string
  href: string
  district: DistrictId
  createdAt: number
  read: boolean
}

/* ------------------------------------------------------------------ */
/* Whole-world state                                                    */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Ads — one sponsored mini banner per Place                            */
/* ------------------------------------------------------------------ */

export interface Ad {
  id: ID
  ownerId: ID
  business: string
  headline: string
  image: string
  url: string
  district: DistrictId
  plan: 'week' | 'month'
  startsAt: number
  endsAt: number
  via: 'stripe' | 'test'
  createdAt: number
}

/* ------------------------------------------------------------------ */
/* Hiring & Workrooms                                                   */
/* ------------------------------------------------------------------ */

export interface Invoice {
  id: ID
  /** Cents. */
  amount: number
  description: string
  /** Where the employer pays (e.g. the worker's Stripe Payment Link). */
  payLink?: string
  status: 'open' | 'paid'
  createdAt: number
  paidAt?: number
}

export interface Contract {
  id: ID
  title: string
  opportunityId?: ID
  employerId: ID
  workerId: ID
  rate: string
  status: 'active' | 'completed'
  workroomId: ID
  invoices: Invoice[]
  createdAt: number
}

export interface WorkMessage {
  id: ID
  channelId: ID
  senderId: ID
  body: string
  createdAt: number
}

export interface Workroom {
  id: ID
  name: string
  ownerId: ID
  memberIds: ID[]
  channels: { id: ID; name: string }[]
  messages: WorkMessage[]
  contractId?: ID
  /** Last time each member opened the room. */
  readAt: Record<ID, number>
  createdAt: number
}

export interface WorldState {
  version: number
  /** Signed-in account on this device (null = guest). */
  accountId: ID | null
  /** Accounts created on this device. */
  accounts: Account[]
  people: Person[]
  following: Record<ID, ID[]>
  posts: Post[]
  courses: Course[]
  enrollments: Record<ID, Enrollment[]>
  discussions: Discussion[]
  shops: Shop[]
  products: Product[]
  orders: Order[]
  coursePurchases: CoursePurchase[]
  opportunities: Opportunity[]
  applications: Application[]
  ads: Ad[]
  contracts: Contract[]
  workrooms: Workroom[]
  threads: Thread[]
  saved: Record<ID, SavedItem[]>
  collections: Record<ID, Collection[]>
  notifications: Record<ID, Notification[]>
}
