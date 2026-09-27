import { withBase } from './base-path'

/** Static-host image loader: serves files from /public as-is, under the base path. */
export default function staticLoader({ src, width }: { src: string; width: number; quality?: number }) {
  return `${withBase(src)}?w=${width}`
}
