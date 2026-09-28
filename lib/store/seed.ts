import type { Course, Discussion, Opportunity, Person, Post, Product, Shop, WorldState } from '@/lib/types'

/** Bump when seed content changes shape; user-created content is preserved across bumps. */
export const SEED_VERSION = 5

const H = 3_600_000
const D = 24 * H

/** Community members who exist before any visitor arrives. */
export const SEED_PEOPLE: Person[] = [
  { id: 'p_josie', name: 'Josie', username: 'josie', avatar: '/media/avatar-josie.webp', bio: 'Creator, mom, entrepreneur. Building a more conscious and connected world. ✨', location: 'Florida, USA', headline: 'Content creator & community builder', interests: ['Sustainable living', 'Wellness', 'Handmade'], skills: ['Content creation', 'Brand design', 'Community building'], joinedAt: 0, baseFollowers: 1200, baseFollowing: 245 },
  { id: 'p_maya', name: 'Maya Chen', username: 'mayamakes', avatar: '/media/avatar-a.webp', bio: 'Ceramicist and plant person. Slow objects for slow mornings.', location: 'Portland, USA', headline: 'Founder, Luna & Co.', interests: ['Ceramics', 'Plants', 'Design'], skills: ['Ceramics', 'Product photography'], joinedAt: 0, baseFollowers: 3400 },
  { id: 'p_leo', name: 'Leo Hart', username: 'leohart', avatar: '/media/avatar-b.webp', bio: 'Teaching sustainable living one small habit at a time.', location: 'Lisbon, Portugal', headline: 'Sustainability educator', interests: ['Sustainability', 'Gardening', 'Cycling'], skills: ['Teaching', 'Permaculture'], joinedAt: 0, baseFollowers: 8900 },
  { id: 'p_ana', name: 'Ana Ruiz', username: 'anaroams', avatar: '/media/avatar-c.webp', bio: 'Remote team lead. Hiring kind, curious people.', location: 'Mexico City, Mexico', headline: 'People & operations lead', interests: ['Remote work', 'Travel', 'Hiring'], skills: ['Operations', 'Recruiting'], joinedAt: 0, baseFollowers: 2100 },
  { id: 'p_guide', name: 'PLACES Guide', username: 'guide', avatar: '/media/avatar-guide.webp', bio: 'Here to help you find your way around PLACES.', location: 'Everywhere', headline: 'Your guide to PLACES', interests: [], skills: [], joinedAt: 0 },
]

const people = (now: number): Person[] => SEED_PEOPLE.map((p) => ({ ...p, joinedAt: now - 200 * D }))

const posts = (now: number): Post[] => [
  { id: 'post_1', authorId: 'p_josie', body: 'A slower, brighter, more intentional internet is possible. 💚', image: '/media/post-landscape.webp', audience: 'public', createdAt: now - 2 * H, likes: [], baseLikes: 128, comments: [{ id: 'c_1', authorId: 'p_leo', body: 'This is the internet I want to live in.', createdAt: now - H }], baseComments: 23 },
  { id: 'post_2', authorId: 'p_maya', body: 'Opened my little ceramics shop in MarketPlace this morning. Thank you all for the encouragement!', image: '/media/prod-mug.webp', audience: 'public', createdAt: now - 5 * H, likes: [], baseLikes: 342, comments: [], baseComments: 51 },
  {
    id: 'post_3', authorId: 'p_leo', body: 'Which small habit made the biggest difference for you this year?', audience: 'public', createdAt: now - 9 * H, likes: [], baseLikes: 97, comments: [], baseComments: 12,
    poll: [
      { id: 'o1', label: 'Composting', votes: [] },
      { id: 'o2', label: 'Buying second-hand', votes: [] },
      { id: 'o3', label: 'Cycling to work', votes: [] },
    ],
  },
  { id: 'post_4', authorId: 'p_ana', body: 'We just opened three remote roles in WorkPlace. If you care about people and love a tidy spreadsheet, come say hi.', location: 'Mexico City', audience: 'public', createdAt: now - 1.2 * D, likes: [], baseLikes: 64, comments: [], baseComments: 9 },
]

const lessons = (prefix: string, items: [string, number, string][]) =>
  items.map(([title, minutes, body], i) => ({ id: `${prefix}_l${i + 1}`, title, minutes, body }))

const courses = (now: number): Course[] => [
  {
    id: 'crs_sustainable', title: 'Sustainable Living', subtitle: 'A practical guide', kind: 'guide', topic: 'Sustainability', expertId: 'p_leo', image: '/media/learn-sustainable.webp', baseMembers: 120_000,
    description: 'Small, realistic changes for a lighter footprint at home — food, energy, stuff and community.',
    lessons: lessons('sus', [
      ['Start with one habit', 6, 'Pick the change that is easiest for you, not the one that looks best. Consistency beats intensity: a habit you keep for a year does more than a dramatic week.'],
      ['Food without waste', 9, 'Plan three meals ahead, shop with a list and keep a "use first" shelf in the fridge. Freeze bread and herbs before they turn. Compost what is left.'],
      ['Energy at home', 8, 'Draught-proof doors and windows, lower the heating by one degree and wash at 30°C. Switch to a renewable tariff if one is available where you live.'],
      ['Buy less, buy better', 7, 'Borrow, repair and buy second-hand first. When you buy new, choose things that can be mended and will be loved for a long time.'],
    ]),
  },
  {
    id: 'crs_digital', title: 'Digital Skills', subtitle: 'Build your future', kind: 'course', topic: 'Careers', expertId: 'p_ana', image: '/media/learn-digital.webp', baseMembers: 68_000,
    description: 'The practical tools of modern remote work: writing clearly, organising your work and collaborating online.',
    lessons: lessons('dig', [
      ['Writing that gets read', 10, 'Lead with the point. Use short paragraphs and one idea per message. End with the decision or action you need.'],
      ['Organising your week', 8, 'Keep one list. Sort by what moves your goals, not by what is loudest. Block focus time before meetings fill it.'],
      ['Working async', 9, 'Share context in writing, record short videos for walkthroughs and agree on response times with your team.'],
      ['Your portfolio', 12, 'Show three pieces of work with the problem, what you did and the result. Keep it short and link to it everywhere.'],
    ]),
  },
  {
    id: 'crs_wellness', title: 'Health & Wellness', subtitle: 'Mind • Body', kind: 'course', topic: 'Wellness', expertId: 'p_josie', image: '/media/learn-health.webp', baseMembers: 74_000,
    description: 'Gentle routines for energy, focus and rest — built around real, busy lives.',
    lessons: lessons('wel', [
      ['A calmer morning', 6, 'Keep the first ten minutes screen-free. Water, light and a short walk set the tone for the day.'],
      ['Movement you enjoy', 7, 'The best exercise is the one you will do. Two short walks count. So does dancing in the kitchen.'],
      ['Rest on purpose', 8, 'Protect a wind-down hour. Dim lights, write tomorrow’s list and put the phone in another room.'],
    ]),
  },
  {
    id: 'crs_writing', title: 'Creative Writing', subtitle: 'Live workshop', kind: 'live', topic: 'Creativity', expertId: 'p_maya', image: '/media/learn-writing.webp', baseMembers: 31_000, startsAt: now + 2 * D,
    description: 'A friendly live workshop: short prompts, shared drafts and kind feedback.',
    lessons: lessons('wri', [
      ['Warm-up prompts', 15, 'Write for five minutes without stopping. Do not edit. Circle one sentence you like.'],
      ['Finding your voice', 20, 'Read your circled sentence aloud. What makes it sound like you? Write a paragraph that keeps that sound.'],
    ]),
  },
  {
    id: 'crs_garden', title: 'Grow Your Own', subtitle: 'Balcony gardening', kind: 'guide', topic: 'Sustainability', expertId: 'p_leo', image: '/media/learn-garden.webp', baseMembers: 42_000,
    description: 'Herbs, salad and tomatoes in small spaces — containers, soil, light and watering.',
    lessons: lessons('gar', [
      ['Light and containers', 7, 'Most edibles need six hours of sun. Use pots with drainage holes and at least 20 cm of depth.'],
      ['Soil and feeding', 6, 'Use peat-free compost and feed every two weeks in summer.'],
      ['What to grow first', 8, 'Start with mint, basil, lettuce and cherry tomatoes. They forgive mistakes.'],
    ]),
  },
  {
    id: 'crs_shop', title: 'Start a Small Shop', subtitle: 'From idea to first sale', kind: 'course', topic: 'Business', expertId: 'p_maya', image: '/media/learn-shop.webp', baseMembers: 27_000, price: 2900,
    description: 'Open your MarketPlace shop: products, photos, pricing and getting paid with Stripe.',
    lessons: lessons('shp', [
      ['Choose three products', 8, 'Start small. Three great products tell a clearer story than thirty.'],
      ['Photos that sell', 10, 'Use daylight, a plain background and show the object in use.'],
      ['Pricing with confidence', 9, 'Materials + time + overheads, then check what similar makers charge. Do not undercharge.'],
      ['Getting paid', 7, 'Create a Stripe Payment Link for each product and paste it into your listing. Buyers pay you directly.'],
    ]),
  },
]

const discussions = (now: number): Discussion[] => [
  { id: 'dsc_1', title: 'Best remote jobs for beginners?', body: 'I am switching careers and would love to hear which remote roles are realistic to start in without years of experience.', authorId: 'p_ana', category: 'WorkPlace', tone: 'teal', createdAt: now - 2 * H, upvoters: [], baseUpvotes: 1200, replies: [{ id: 'r_1', authorId: 'p_josie', body: 'Virtual assistant and customer support roles taught me so much. Both are in WorkPlace right now!', createdAt: now - H }], baseReplies: 341 },
  { id: 'dsc_2', title: 'Tips for starting an online store', body: 'What do you wish you had known before opening your first shop?', authorId: 'p_maya', category: 'MarketPlace', tone: 'coral', createdAt: now - 5 * H, upvoters: [], baseUpvotes: 864, replies: [], baseReplies: 187 },
  { id: 'dsc_3', title: 'Favorite countries for digital nomads', body: 'Planning a year of slow travel. Where did you feel most at home while working remotely?', authorId: 'p_leo', category: 'Travel', tone: 'sun', createdAt: now - D, upvoters: [], baseUpvotes: 2100, replies: [], baseReplies: 420 },
  { id: 'dsc_4', title: 'How do you keep a daily learning habit?', body: 'I start strong every month and then drift. What keeps you going?', authorId: 'p_josie', category: 'Growth', tone: 'lavender', createdAt: now - 2 * D, upvoters: [], baseUpvotes: 540, replies: [], baseReplies: 96 },
  { id: 'dsc_5', title: 'Balcony tomatoes: pots or grow bags?', body: 'First summer growing food. Which worked better for you?', authorId: 'p_leo', category: 'Gardening', tone: 'leaf', createdAt: now - 3 * D, upvoters: [], baseUpvotes: 212, replies: [], baseReplies: 38 },
]

const shops = (now: number): Shop[] => [
  { id: 'shp_sunsoil', name: 'Sun & Soil', category: 'Home & Garden', description: 'Plants, pots and slow-living goods for sunny corners.', image: '/media/shop-sunsoil.webp', ownerId: 'p_leo', createdAt: now - 90 * D },
  { id: 'shp_luna', name: 'Luna & Co.', category: 'Handmade Goods', description: 'Hand-thrown ceramics and macramé, made in small batches.', image: '/media/shop-luna.webp', ownerId: 'p_maya', createdAt: now - 60 * D },
  { id: 'shp_bloom', name: 'Digital Bloom', category: 'Templates & Tools', description: 'Printable art, planners and templates for creative people.', image: '/media/shop-bloom.webp', ownerId: 'p_josie', createdAt: now - 45 * D },
]

const products = (now: number): Product[] => [
  { id: 'prd_prints', shopId: 'shp_bloom', title: 'Botanical Prints', description: 'A set of six printable botanical illustrations. Instant download, print at home up to A3.', price: 2800, image: '/media/prod-prints.webp', category: 'Digital', createdAt: now - 10 * D },
  { id: 'prd_hanger', shopId: 'shp_luna', title: 'Macrame Plant Hanger', description: 'Hand-knotted cotton hanger for pots up to 18 cm. Each one is slightly different.', price: 3600, image: '/media/prod-hanger.webp', category: 'Handmade', createdAt: now - 8 * D },
  { id: 'prd_journal', shopId: 'shp_sunsoil', title: 'Wellness Journal', description: 'A 12-week guided journal for gentle routines, gratitude and rest.', price: 2200, image: '/media/prod-journal.webp', category: 'Wellness', createdAt: now - 6 * D },
  { id: 'prd_mug', shopId: 'shp_luna', title: 'Ceramic Mug Set', description: 'Two hand-thrown stoneware mugs in soft cream and blush glazes. Dishwasher safe.', price: 4800, image: '/media/prod-mug.webp', category: 'Handmade', createdAt: now - 4 * D },
  { id: 'prd_planter', shopId: 'shp_sunsoil', title: 'Terracotta Planter Trio', description: 'Three unglazed terracotta planters with saucers — small, medium and large.', price: 3400, image: '/media/shop-sunsoil.webp', category: 'Home', createdAt: now - 3 * D },
  { id: 'prd_planner', shopId: 'shp_bloom', title: 'Creator Planner Template', description: 'Notion + printable planner for content calendars, launches and weekly reviews.', price: 1500, image: '/media/shop-bloom.webp', category: 'Digital', createdAt: now - 2 * D },
  { id: 'prd_session', shopId: 'shp_bloom', title: 'Brand Photo Session (1h)', description: 'A one-hour remote session to plan and art-direct your product photos.', price: 9000, image: '/media/shop-luna.webp', category: 'Services', createdAt: now - D },
]

const opportunities = (now: number): Opportunity[] => [
  { id: 'opp_1', title: 'Social Media Content Creator', org: 'Sun & Soil', postedById: 'p_leo', icon: 'leaf', iconTone: 'leaf', location: 'Remote', type: 'Part Time', kind: 'job', tags: ['Marketing', 'Creative'], pay: '$25–35/hr', description: 'Plan and create short videos and posts that show slow living at its best. 15–20 hours a week, flexible schedule.', createdAt: now - 3 * H },
  { id: 'opp_2', title: 'Virtual Assistant', org: 'Remote Creators Co.', postedById: 'p_ana', icon: 'sun', iconTone: 'sun', location: 'Remote', type: 'Flexible', kind: 'job', tags: ['Admin', 'Operations'], pay: '$18–25/hr', description: 'Inbox, calendar and light bookkeeping for a small creative team. Great first remote role.', createdAt: now - 8 * H },
  { id: 'opp_3', title: 'Website Designer', org: 'Luna & Co.', postedById: 'p_maya', icon: 'waves', iconTone: 'sky', location: 'Remote', type: 'Project', kind: 'project', tags: ['Web Design', 'Creative'], pay: '$500–1,500', description: 'Refresh a small ceramics shop website: homepage, product pages and a simple story page.', createdAt: now - D },
  { id: 'opp_4', title: 'Customer Support (Remote)', org: 'Remote Creators Co.', postedById: 'p_ana', icon: 'gem', iconTone: 'teal', location: 'Remote', type: 'Full Time', kind: 'job', tags: ['Support', 'Customer Service'], pay: '$45–60k', description: 'Help our members with kindness and clarity across chat and email. Training provided.', createdAt: now - 1.5 * D },
  { id: 'opp_5', title: 'Community Manager', org: 'PLACES', postedById: 'p_guide', icon: 'megaphone', iconTone: 'coral', location: 'Lisbon · Hybrid', type: 'Full Time', kind: 'team', tags: ['Community', 'Events'], pay: '$52–64k', description: 'Grow warm, well-moderated communities in MindPlace and host monthly live events.', createdAt: now - 2 * D },
  { id: 'opp_6', title: 'Brand Illustrator', org: 'Digital Bloom', postedById: 'p_josie', icon: 'palette', iconTone: 'lavender', location: 'Remote', type: 'Freelance', kind: 'service', tags: ['Illustration', 'Branding'], pay: '$60–90/hr', description: 'Hand-drawn botanical illustrations for a new print collection. Portfolio required.', createdAt: now - 3 * D },
]

/** Deterministic starting world. `now` anchors relative timestamps. */
export function seedWorld(now: number): WorldState {
  return {
    version: SEED_VERSION,
    accountId: null,
    accounts: [],
    people: people(now),
    following: {},
    posts: posts(now),
    courses: courses(now),
    enrollments: {},
    discussions: discussions(now),
    shops: shops(now),
    products: products(now),
    orders: [],
    coursePurchases: [],
    opportunities: opportunities(now),
    applications: [],
    ads: [],
    contracts: [],
    workrooms: [],
    threads: [],
    saved: {},
    collections: {},
    notifications: {},
  }
}

/** Fixed anchor for server rendering so server and first client render match. */
export const SERVER_NOW = Date.UTC(2026, 8, 27, 12)
