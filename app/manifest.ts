import type { MetadataRoute } from 'next'
import { withBase } from '@/lib/base-path'

export const dynamic = 'force-static'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PLACES FOR US — The Conscious Web',
    short_name: 'PLACES',
    description: 'The internet, made into a world.',
    start_url: withBase('/'),
    display: 'standalone',
    background_color: '#FFF9EF',
    theme_color: '#FFF9EF',
    icons: [
      { src: withBase('/icon.svg'), sizes: 'any', type: 'image/svg+xml' },
      { src: withBase('/apple-icon.png'), sizes: '180x180', type: 'image/png' },
    ],
  }
}
