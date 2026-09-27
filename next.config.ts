import type { NextConfig } from 'next'

/**
 * Set PAGES_BASE_PATH (e.g. "/myplace") to produce a static export for GitHub Pages.
 * Without it, the app builds as a normal Next.js server app with image optimization.
 */
const basePath = process.env.PAGES_BASE_PATH

const nextConfig: NextConfig = basePath
  ? {
      output: 'export',
      basePath,
      trailingSlash: true,
      env: { NEXT_PUBLIC_BASE_PATH: basePath },
      images: { loader: 'custom', loaderFile: './lib/image-loader.ts' },
    }
  : {
      images: {
        formats: ['image/avif', 'image/webp'],
        qualities: [75, 85],
      },
    }

export default nextConfig
