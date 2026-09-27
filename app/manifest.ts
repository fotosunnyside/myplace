import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PLACES — The Conscious Web',
    short_name: 'PLACES',
    description: 'The internet, made into a world.',
    start_url: '/',
    display: 'standalone',
    background_color: '#FFF9EF',
    theme_color: '#FFF9EF',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
