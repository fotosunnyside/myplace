import { BACKGROUND_MAX_BYTES, checkBackgroundFile } from './rooms'

/**
 * Prepares an admin's background image for upload: checks the type, scales it to a sensible size for
 * full-screen rooms, and encodes it as WebP (JPEG where WebP isn't supported) under the storage limit.
 */
export async function prepareBackground(file: File, maxEdge = 2560): Promise<Blob> {
  const problem = checkBackgroundFile(file)
  if (problem) throw new Error(problem)
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = () => reject(new Error('That image could not be read.'))
      i.src = url
    })
    if (img.naturalWidth < 640 || img.naturalHeight < 360) throw new Error('That image is too small for a room. Use one at least 1280 px wide.')
    const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    for (const quality of [0.86, 0.78, 0.68, 0.58]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', quality))
      const out = blob?.type === 'image/webp' ? blob : await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', quality))
      if (out && out.size <= BACKGROUND_MAX_BYTES) return out
    }
    throw new Error('That image is too detailed to fit in 5 MB. Try a smaller one.')
  } finally {
    URL.revokeObjectURL(url)
  }
}
