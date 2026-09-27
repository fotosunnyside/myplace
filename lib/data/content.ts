import type { Author, Discussion, LearningItem, Opportunity, Post, Product, Shop } from '@/lib/types'
import { currentUser } from './identity'

const me: Author = {
  name: currentUser.profile.name,
  username: currentUser.profile.username,
  avatar: currentUser.profile.avatar,
}

const people: Record<string, Author> = {
  maya: { name: 'Maya Chen', username: 'mayamakes', avatar: '/media/avatar-a.webp' },
  leo: { name: 'Leo Hart', username: 'leohart', avatar: '/media/avatar-b.webp' },
  ana: { name: 'Ana Ruiz', username: 'anaroams', avatar: '/media/avatar-c.webp' },
}

/* ---------------------------- YourPlace ---------------------------- */

export const posts: Post[] = [
  {
    id: 'post1',
    author: me,
    postedAgo: '2h',
    body: 'A slower, brighter, more intentional internet is possible. 💚',
    image: '/media/post-landscape.webp',
    likes: 128,
    comments: 24,
    audience: 'friends',
  },
  {
    id: 'post2',
    author: people.maya,
    postedAgo: '5h',
    body: 'Opened my little ceramics shop in MarketPlace this morning. Thank you all for the encouragement!',
    image: '/media/prod-mug.webp',
    likes: 342,
    comments: 51,
    audience: 'following',
  },
  {
    id: 'post3',
    author: people.leo,
    postedAgo: '1d',
    body: 'Finished the Sustainable Living guide in MindPlace. Composting setup is officially running.',
    likes: 97,
    comments: 12,
    audience: 'communities',
  },
]

/* ---------------------------- MindPlace ---------------------------- */

export const learning: LearningItem[] = [
  { id: 'l1', title: 'Sustainable Living', subtitle: 'A practical guide', image: '/media/learn-sustainable.webp', members: '120k members', kind: 'guide' },
  { id: 'l2', title: 'Digital Skills', subtitle: 'Build your future', image: '/media/learn-digital.webp', members: '68k members', kind: 'course' },
  { id: 'l3', title: 'Health & Wellness', subtitle: 'Mind • Body', image: '/media/learn-health.webp', members: '74k members', kind: 'course' },
  { id: 'l4', title: 'Creative Writing', subtitle: 'Live workshop', image: '/media/banner-mindplace-thumb.webp', members: '31k members', kind: 'live' },
]

export const discussions: Discussion[] = [
  { id: 'd1', title: 'Best remote jobs for beginners?', author: people.ana, category: 'WorkPlace', categoryTone: 'teal', comments: 342, postedAgo: '2h ago', upvotes: '1.2k' },
  { id: 'd2', title: 'Tips for starting an online store', author: people.maya, category: 'MarketPlace', categoryTone: 'coral', comments: 187, postedAgo: '5h ago', upvotes: '864' },
  { id: 'd3', title: 'Favorite countries for digital nomads', author: people.leo, category: 'Travel', categoryTone: 'sun', comments: 420, postedAgo: '1d ago', upvotes: '2.1k' },
  { id: 'd4', title: 'How do you keep a daily learning habit?', author: me, category: 'Growth', categoryTone: 'lavender', comments: 96, postedAgo: '2d ago', upvotes: '540' },
]

/* --------------------------- MarketPlace --------------------------- */

export const shops: Shop[] = [
  { id: 'sh1', name: 'Sun & Soil', category: 'Home & Garden', image: '/media/shop-sunsoil.webp' },
  { id: 'sh2', name: 'Luna & Co.', category: 'Handmade Goods', image: '/media/shop-luna.webp' },
  { id: 'sh3', name: 'Digital Bloom', category: 'Templates & Tools', image: '/media/shop-bloom.webp' },
]

export const products: Product[] = [
  { id: 'p1', title: 'Botanical Prints', price: '$28', image: '/media/prod-prints.webp', shop: 'Digital Bloom' },
  { id: 'p2', title: 'Macrame Plant Hanger', price: '$36', image: '/media/prod-hanger.webp', shop: 'Luna & Co.' },
  { id: 'p3', title: 'Wellness Journal', price: '$22', image: '/media/prod-journal.webp', shop: 'Sun & Soil' },
  { id: 'p4', title: 'Ceramic Mug Set', price: '$48', image: '/media/prod-mug.webp', shop: 'Luna & Co.' },
]

/* ---------------------------- WorkPlace ---------------------------- */

export const opportunities: Opportunity[] = [
  { id: 'o1', title: 'Social Media Content Creator', icon: 'leaf', iconTone: 'leaf', location: 'Remote', type: 'Part Time', tags: ['Marketing', 'Creative'], pay: '$25–35/hr' },
  { id: 'o2', title: 'Virtual Assistant', icon: 'sun', iconTone: 'sun', location: 'Remote', type: 'Flexible', tags: ['Admin', 'Operations'], pay: '$18–25/hr' },
  { id: 'o3', title: 'Website Designer', icon: 'waves', iconTone: 'sky', location: 'Remote', type: 'Project', tags: ['Web Design', 'Creative'], pay: '$500–1,500' },
  { id: 'o4', title: 'Customer Support (Remote)', icon: 'gem', iconTone: 'teal', location: 'Remote', type: 'Full Time', tags: ['Support', 'Customer Service'], pay: '$45–60k' },
  { id: 'o5', title: 'Community Manager', icon: 'megaphone', iconTone: 'coral', location: 'Lisbon · Hybrid', type: 'Full Time', tags: ['Community', 'Events'], pay: '$52–64k' },
  { id: 'o6', title: 'Brand Illustrator', icon: 'palette', iconTone: 'lavender', location: 'Remote', type: 'Freelance', tags: ['Illustration', 'Branding'], pay: '$60–90/hr' },
]
