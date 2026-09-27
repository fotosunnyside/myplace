import type { PlacesIdentity } from '@/lib/types'

/**
 * The signed-in user. One identity that travels across every Place.
 * Replace with a fetch from the identity service when a backend exists.
 */
export const currentUser: PlacesIdentity = {
  profile: {
    id: 'u_josie',
    name: 'Josie',
    username: 'josie',
    avatar: '/media/avatar-josie.webp',
    bio: 'Creator, mom, entrepreneur. Building a more conscious and connected world. ✨',
    location: 'Florida, USA',
    joinedAt: '2026-01-14',
    interests: ['Sustainable living', 'Digital nomad life', 'Handmade goods', 'Wellness'],
    skills: ['Content creation', 'Brand design', 'Community building'],
  },
  connections: {
    following: 245,
    followers: 1200,
    friends: 86,
    communities: ['Sustainable Living', 'Remote Creators', 'Florida Makers'],
  },
  reputation: {
    score: 87,
    badges: [
      { id: 'b1', label: 'Helpful Voice', district: 'mindplace' },
      { id: 'b2', label: 'Trusted Seller', district: 'marketplace' },
      { id: 'b3', label: 'Reliable Collaborator', district: 'workplace' },
    ],
  },
  saved: [
    { id: 's1', district: 'mindplace', kind: 'course', refId: 'l1', savedAt: '2026-09-20' },
    { id: 's2', district: 'marketplace', kind: 'product', refId: 'p2', savedAt: '2026-09-22' },
    { id: 's3', district: 'workplace', kind: 'opportunity', refId: 'o1', savedAt: '2026-09-25' },
  ],
  collections: [
    { id: 'c1', title: 'Slow living', cover: '/media/post-landscape.webp', itemCount: 24 },
    { id: 'c2', title: 'Plant corner', cover: '/media/shop-sunsoil.webp', itemCount: 18 },
    { id: 'c3', title: 'Studio ideas', cover: '/media/shop-luna.webp', itemCount: 31 },
    { id: 'c4', title: 'Learning list', cover: '/media/learn-sustainable.webp', itemCount: 16 },
  ],
  activity: {
    learning: { coursesInProgress: 2, coursesCompleted: 7, discussionsStarted: 12, helpfulAnswers: 48 },
    shop: { shopName: 'Josie Makes', listings: 14, purchases: 22, favourites: 63 },
    professional: {
      headline: 'Content creator & community builder',
      openTo: ['freelance', 'collaboration'],
      applications: 3,
      projects: 5,
    },
  },
}

export const formatCount = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace(/\.0$/, '')}K` : String(n)
