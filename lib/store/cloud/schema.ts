/**
 * The shared world's tables (supabase/migrations/20260929120000_world.sql, *_pricing.sql) and what this app may write to each.
 * The database's row-level security is the real authority; this only keeps the app from asking for more.
 */

export type Row = Record<string, unknown>

export interface TableSpec {
  /** Primary-key columns. */
  pk: string[]
  /** New rows may be created. */
  insert?: boolean
  /** Columns that may change after creation. */
  update?: string[]
  /** Rows may be removed. */
  del?: boolean
  /** Readable by guests (otherwise loaded only when signed in). */
  public?: boolean
  /** Newest-first cap when loading. */
  limit?: { column: string; rows: number }
}

/** In dependency order: creates run top to bottom, removals bottom to top. */
export const TABLES = {
  profiles: { pk: ['id'], update: ['name', 'avatar', 'bio', 'location', 'headline', 'interests', 'skills', 'open_to'], public: true },
  member_plans: { pk: ['user_id', 'kind'], insert: true, update: ['quantity', 'status', 'via', 'since', 'renews_at'], public: true },
  follows: { pk: ['follower_id', 'followee_id'], insert: true, del: true, public: true },
  posts: { pk: ['id'], insert: true, update: ['body', 'image', 'link', 'location', 'poll', 'audience'], del: true, public: true, limit: { column: 'created_at', rows: 500 } },
  post_likes: { pk: ['post_id', 'user_id'], insert: true, del: true, public: true },
  post_comments: { pk: ['id'], insert: true, del: true, public: true },
  poll_votes: { pk: ['post_id', 'user_id'], insert: true, update: ['option_id'], del: true, public: true },
  saved_items: { pk: ['user_id', 'kind', 'ref_id'], insert: true, del: true },
  collections: { pk: ['id'], insert: true, update: ['title', 'items'], del: true },
  courses: { pk: ['id'], insert: true, update: ['title', 'subtitle', 'description', 'image', 'kind', 'topic', 'price', 'billing', 'stripe_link'], del: true, public: true },
  course_lessons: { pk: ['id'], insert: true, update: ['position', 'title', 'minutes'], del: true, public: true },
  lesson_bodies: { pk: ['lesson_id'], insert: true, update: ['body'], del: true, public: true },
  course_purchases: { pk: ['id'], insert: true },
  enrollments: { pk: ['user_id', 'course_id'], insert: true, update: ['completed'], del: true },
  discussions: { pk: ['id'], insert: true, update: ['title', 'body', 'category', 'tone'], del: true, public: true },
  discussion_upvotes: { pk: ['discussion_id', 'user_id'], insert: true, del: true, public: true },
  discussion_replies: { pk: ['id'], insert: true, del: true, public: true },
  shops: { pk: ['id'], insert: true, update: ['name', 'category', 'description', 'image'], del: true, public: true },
  products: { pk: ['id'], insert: true, update: ['title', 'description', 'price', 'image', 'category', 'stripe_link', 'ships'], del: true, public: true },
  orders: { pk: ['id'], insert: true },
  opportunities: { pk: ['id'], insert: true, update: ['title', 'org', 'icon', 'icon_tone', 'location', 'type', 'kind', 'tags', 'pay', 'description'], del: true, public: true },
  applications: { pk: ['id'], insert: true },
  threads: { pk: ['id'], insert: true },
  thread_participants: { pk: ['thread_id', 'user_id'], insert: true, update: ['read_at'] },
  messages: { pk: ['id'], insert: true },
  notifications: { pk: ['id'], update: ['read'], limit: { column: 'created_at', rows: 100 } },
  ads: { pk: ['id'], insert: true, del: true, public: true },
  workrooms: { pk: ['id'], insert: true, update: ['name'] },
  workroom_members: { pk: ['workroom_id', 'user_id'], insert: true, update: ['read_at'] },
  workroom_channels: { pk: ['id'], insert: true },
  contracts: { pk: ['id'], insert: true, update: ['status'] },
  workroom_messages: { pk: ['id'], insert: true },
  invoices: { pk: ['id'], insert: true, update: ['status', 'paid_at'] },
} satisfies Record<string, TableSpec>

export type TableName = keyof typeof TABLES
export const TABLE_ORDER = Object.keys(TABLES) as TableName[]
export const spec = (t: TableName): TableSpec => TABLES[t]

export type CloudData = Record<TableName, Row[]>
export type RowSet = Record<TableName, Map<string, Row>>

export const keyOf = (t: TableName, row: Row) => spec(t).pk.map((c) => String(row[c])).join('\u0001')

export const emptyRowSet = (): RowSet => Object.fromEntries(TABLE_ORDER.map((t) => [t, new Map()])) as RowSet
