import { describe, expect, it } from 'vitest'
import { embedUrl, MUSIC_SUGGESTIONS, youtubeId } from '@/lib/spaces/music'

describe('room music', () => {
  it('reads a video id from any kind of YouTube link', () => {
    for (const link of [
      'https://www.youtube.com/watch?v=jfKfPfyJRdk',
      'https://youtu.be/jfKfPfyJRdk?si=abc',
      'https://m.youtube.com/watch?v=jfKfPfyJRdk&t=30',
      'https://www.youtube.com/live/jfKfPfyJRdk',
      'https://www.youtube.com/shorts/jfKfPfyJRdk',
      'https://www.youtube-nocookie.com/embed/jfKfPfyJRdk',
      'jfKfPfyJRdk',
    ])
      expect(youtubeId(link), link).toBe('jfKfPfyJRdk')
    for (const bad of ['https://vimeo.com/123456', 'https://www.youtube.com/watch?v=short', 'hello', 'https://evil.example/watch?v=jfKfPfyJRdk'])
      expect(youtubeId(bad), bad).toBeNull()
  })

  it('starts everyone where the room is up to', () => {
    const url = embedUrl('jfKfPfyJRdk', '2026-09-30T10:00:00Z', Date.parse('2026-09-30T10:01:30Z'))
    expect(url).toBe('https://www.youtube-nocookie.com/embed/jfKfPfyJRdk?autoplay=1&playsinline=1&rel=0&start=90')
  })

  it('suggests valid videos', () => {
    expect(MUSIC_SUGGESTIONS.length).toBeGreaterThanOrEqual(3)
    for (const s of MUSIC_SUGGESTIONS) expect(youtubeId(s.videoId)).toBe(s.videoId)
  })
})
