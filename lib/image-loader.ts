import { withBase } from './base-path'
import variants from './image-variants.json'

const table = variants as Record<string, number[]>

/**
 * Static-host image loader (GitHub Pages has no image optimizer).
 * Picks the smallest pre-built width (tools/build-assets.py) that covers the request.
 */
export default function staticLoader({ src, width }: { src: string; width: number; quality?: number }) {
  if (!src.startsWith('/')) return src
  const widths = table[src]
  if (!widths) return withBase(src)
  const w = widths.find((x) => x >= width) ?? widths[widths.length - 1]
  return withBase(w === widths[widths.length - 1] ? src : src.replace(/\.webp$/, `.w${w}.webp`))
}
