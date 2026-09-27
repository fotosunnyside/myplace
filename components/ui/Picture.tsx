import Image, { type ImageProps } from 'next/image'

/** next/image that also accepts photos people uploaded (stored as data URLs). */
export function Picture(props: ImageProps) {
  const src = typeof props.src === 'string' ? props.src : ''
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} unoptimized={props.unoptimized || src.startsWith('data:') || src.startsWith('blob:')} />
}
