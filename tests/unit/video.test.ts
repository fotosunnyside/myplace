import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkVideo, DEVICE_VIDEO_MAX_MB, VIDEO_MAX_MB, VIDEO_TYPES } from '@/lib/video'

const MB = 1024 * 1024

describe('video posts', () => {
  it('takes MP4, WebM and MOV up to the size limit', () => {
    expect(checkVideo({ type: 'video/mp4', size: 10 * MB })).toBeNull()
    expect(checkVideo({ type: 'video/quicktime', size: VIDEO_MAX_MB * MB })).toBeNull()
    expect(checkVideo({ type: 'video/avi', size: MB })).toMatch(/MP4, WebM or MOV/)
    expect(checkVideo({ type: 'video/mp4', size: VIDEO_MAX_MB * MB + 1 })).toMatch(/50 MB/)
    expect(checkVideo({ type: 'video/webm', size: 20 * MB }, DEVICE_VIDEO_MAX_MB)).toMatch(/15 MB/)
  })

  it('matches what the storage bucket accepts', () => {
    const sql = readFileSync('supabase/migrations/20260930160000_post_videos.sql', 'utf8')
    expect(sql).toContain(String(VIDEO_MAX_MB * MB))
    for (const t of VIDEO_TYPES) expect(sql).toContain(`'${t}'`)
  })
})
