import { describe, expect, it } from 'vitest'
import { checkTrackFile, formatDuration, playbackPosition, titleFromFile } from '@/lib/spaces/music'

describe('room music', () => {
  it('starts listeners where the room is up to, looping the track', () => {
    const start = '2026-09-30T10:00:00Z'
    expect(playbackPosition(start, 200, Date.parse('2026-09-30T10:01:30Z'))).toBe(90)
    expect(playbackPosition(start, 60, Date.parse('2026-09-30T10:01:30Z'))).toBe(30)
    expect(playbackPosition(start, null, Date.parse('2026-09-30T10:01:30Z'))).toBe(0)
    expect(playbackPosition(start, 200, Date.parse('2026-09-30T09:59:00Z'))).toBe(0)
  })

  it('formats lengths and tidies titles from file names', () => {
    expect(formatDuration(187)).toBe('3:07')
    expect(formatDuration(null)).toBe('')
    expect(titleFromFile('Morning_Coffee  Beats.mp3')).toBe('Morning Coffee Beats')
  })

  it('accepts audio files up to 20 MB', () => {
    expect(checkTrackFile({ type: 'audio/mpeg', size: 5_000_000 })).toBeNull()
    expect(checkTrackFile({ type: 'video/mp4', size: 5_000_000 })).toMatch(/audio file/)
    expect(checkTrackFile({ type: 'audio/mpeg', size: 30_000_000 })).toMatch(/20 MB/)
  })
})
