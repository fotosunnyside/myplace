import { getState, getWorldMode } from '@/lib/store/store'

/** Videos people can add to posts. Keep in step with the `videos` bucket (supabase/migrations/*_post_videos.sql). */
export const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const VIDEO_MAX_MB = 50
/** Without the backend, videos stay on this device inside the post, so keep them small. */
export const DEVICE_VIDEO_MAX_MB = 15

/** Checks a chosen video; returns a message when it can't be used. */
export function checkVideo(file: { type: string; size: number }, maxMb = VIDEO_MAX_MB): string | null {
  if (!VIDEO_TYPES.includes(file.type)) return 'Please choose an MP4, WebM or MOV video.'
  if (file.size > maxMb * 1024 * 1024) return `That video is larger than ${maxMb} MB.`
  return null
}

/**
 * Gets a chosen video ready for a post: uploaded to the member's own folder when PLACES is connected
 * (the post keeps just the link), or kept on this device otherwise.
 */
export async function prepareVideo(file: File): Promise<string> {
  const me = getState().accountId
  if (getWorldMode() === 'cloud' && me) {
    const problem = checkVideo(file)
    if (problem) throw new Error(problem)
    const { uploadVideo } = await import('@/lib/store/cloud/driver')
    return uploadVideo(file, me)
  }
  const problem = checkVideo(file, DEVICE_VIDEO_MAX_MB)
  if (problem) throw new Error(problem)
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('That video could not be read.'))
    r.readAsDataURL(file)
  })
}
