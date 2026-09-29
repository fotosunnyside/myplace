'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { ImagePlus, Loader2, RotateCcw, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { TextArea, TextField } from '@/components/ui/fields'
import { Button, Card } from '@/components/ui/primitives'
import { RoomBackdrop } from '@/components/spaces/RoomBackdrop'
import { prepareBackground } from '@/lib/spaces/image'
import { CAPACITY_MAX, CAPACITY_MIN, DESCRIPTION_MAX, NAME_MAX, validatePatch } from '@/lib/spaces/rooms'
import { applySpace, spacesBackend, useOccupancy, useSpaces } from '@/lib/spaces/store'
import type { BackgroundStyle, SpacePatch, VirtualSpace } from '@/lib/spaces/types'
import { SpaceError } from '@/lib/spaces/types'
import { toast } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { AdminGate } from './AdminGate'

/** /admin/spaces/edit/?id= — edit one room. Nothing here needs code, a commit or a redeploy. */
export function SpaceEditorPage() {
  const id = useSearchParams().get('id')
  const spaces = useSpaces()
  const space = spaces.status === 'ready' ? spaces.data.find((s) => s.id === id) : undefined
  return (
    <AdminGate title={space ? `Edit ${space.name}` : 'Edit room'} back={{ href: '/admin/spaces', label: 'Virtual Spaces' }}>
      {spaces.status === 'loading' ? (
        <div className="h-64 animate-pulse rounded-panel bg-white/60" />
      ) : space ? (
        <SpaceEditor key={space.id} space={space} />
      ) : (
        <p className="rounded-panel bg-white/70 p-8 text-center text-muted">We couldn’t find that room.</p>
      )}
    </AdminGate>
  )
}

interface Draft {
  name: string
  description: string
  capacity: string
  isActive: boolean
  allowCamera: boolean
  allowMicrophone: boolean
  backgroundStyle: BackgroundStyle
  backgroundUrl: string | null
  backgroundPath: string | null
  focusX: number
  focusY: number
  /** A new image chosen but not saved yet. */
  file: Blob | null
  preview: string | null
}

const draftFrom = (s: VirtualSpace): Draft => ({
  name: s.name,
  description: s.description,
  capacity: String(s.maxParticipants),
  isActive: s.isActive,
  allowCamera: s.allowCamera,
  allowMicrophone: s.allowMicrophone,
  backgroundStyle: s.backgroundStyle,
  backgroundUrl: s.backgroundUrl,
  backgroundPath: s.backgroundPath,
  focusX: s.focusX,
  focusY: s.focusY,
  file: null,
  preview: null,
})

function patchFrom(d: Draft, s: VirtualSpace): SpacePatch {
  const patch: SpacePatch = {}
  if (d.name.trim() !== s.name) patch.name = d.name.trim()
  if (d.description !== s.description) patch.description = d.description
  const cap = Number(d.capacity)
  if (d.capacity.trim() === '' || cap !== s.maxParticipants) patch.maxParticipants = d.capacity.trim() === '' ? NaN : cap
  if (d.isActive !== s.isActive) patch.isActive = d.isActive
  if (d.allowCamera !== s.allowCamera) patch.allowCamera = d.allowCamera
  if (d.allowMicrophone !== s.allowMicrophone) patch.allowMicrophone = d.allowMicrophone
  if (d.focusX !== s.focusX) patch.focusX = d.focusX
  if (d.focusY !== s.focusY) patch.focusY = d.focusY
  if (d.file || d.backgroundStyle !== s.backgroundStyle || d.backgroundUrl !== s.backgroundUrl) {
    patch.backgroundStyle = d.backgroundStyle
    patch.backgroundUrl = d.backgroundStyle === 'custom' ? d.backgroundUrl : null
    patch.backgroundPath = d.backgroundStyle === 'custom' ? d.backgroundPath : null
  }
  return patch
}

function SpaceEditor({ space }: { space: VirtualSpace }) {
  const router = useRouter()
  const occupancy = useOccupancy()
  const [draft, setDraft] = useState<Draft>(() => draftFrom(space))
  const [saving, setSaving] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const inside = occupancy?.[space.id] ?? 0
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))

  useEffect(() => () => void (draft.preview && URL.revokeObjectURL(draft.preview)), [draft.preview])

  const patch = patchFrom(draft, space)
  // A staged image gets its URL when it uploads during save.
  const errors = validatePatch(draft.file ? { ...patch, backgroundUrl: undefined } : patch)
  const dirty = Object.keys(patch).length > 0
  const cap = Number(draft.capacity)

  const pick = async (file?: File) => {
    if (!file) return
    setPreparing(true)
    try {
      const blob = await prepareBackground(file)
      set({ file: blob, preview: URL.createObjectURL(blob), backgroundStyle: 'custom', focusX: 50, focusY: 50 })
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setPreparing(false)
      if (input.current) input.current.value = ''
    }
  }

  const save = async () => {
    if (Object.keys(errors).length) return toast(Object.values(errors)[0]!, 'error')
    setSaving(true)
    let uploaded: string | null = null
    try {
      const final = { ...patch }
      if (draft.file) {
        const up = await spacesBackend.uploadBackground(space.id, draft.file)
        uploaded = up.path
        Object.assign(final, { backgroundStyle: 'custom', backgroundUrl: up.url, backgroundPath: up.path })
      }
      const saved = await spacesBackend.updateSpace(space.id, final)
      // The old image is no longer used by this room.
      if (space.backgroundPath && space.backgroundPath !== saved.backgroundPath) spacesBackend.removeBackgroundObject(space.backgroundPath).catch(() => {})
      applySpace(saved)
      setDraft(draftFrom(saved))
      toast(`${saved.name} saved — it’s live now.`)
    } catch (e) {
      if (uploaded) spacesBackend.removeBackgroundObject(uploaded).catch(() => {})
      toast(e instanceof SpaceError ? e.message : 'Couldn’t save the room. Please try again.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const previewSpace = {
    name: draft.name,
    roomType: space.roomType,
    backgroundStyle: draft.backgroundStyle,
    backgroundUrl: draft.preview ?? draft.backgroundUrl,
    focusX: draft.focusX,
    focusY: draft.focusY,
  }
  const hasImage = draft.backgroundStyle !== 'none'

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="grid gap-6">
        <Section title="Details">
          <TextField label="Room name" value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={NAME_MAX} hint={errors.name} aria-invalid={!!errors.name} required />
          <TextArea
            label="Description"
            value={draft.description}
            onChange={(e) => set({ description: e.target.value })}
            maxLength={DESCRIPTION_MAX}
            rows={3}
            hint={errors.description ?? `${draft.description.length}/${DESCRIPTION_MAX} — shown on YourPlace and at the door.`}
          />
        </Section>

        <Section title="Capacity" hint="The most people who can be in the room at once. Checked by the database for every arrival.">
          <div className="flex flex-wrap items-center gap-2">
            <input
              aria-label="Participant capacity"
              type="number"
              inputMode="numeric"
              min={CAPACITY_MIN}
              max={CAPACITY_MAX}
              step={1}
              value={draft.capacity}
              onChange={(e) => set({ capacity: e.target.value })}
              aria-invalid={!!errors.maxParticipants}
              className={cn('h-12 w-28 rounded-2xl border bg-white px-4 text-lg font-semibold text-navy outline-none focus:border-teal/60', errors.maxParticipants ? 'border-coral' : 'border-line')}
            />
            <span className="text-sm text-muted">people</span>
            <div className="ml-auto flex flex-wrap gap-1.5">
              {[10, 20, 25, 30, 50].map((n) => (
                <button key={n} type="button" onClick={() => set({ capacity: String(n) })} className={cn('rounded-full border px-3 py-1.5 text-sm', cap === n ? 'border-teal bg-teal text-white' : 'border-line bg-white text-navy-soft hover:border-teal/40')}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          {errors.maxParticipants && <p className="text-sm text-[#a2412c]">{errors.maxParticipants}</p>}
          {!errors.maxParticipants && inside > cap && <p className="text-sm text-navy-soft">{inside} people are inside now. They can stay; nobody new enters until it’s below {cap}.</p>}
        </Section>

        <Section title="Status and media">
          <Segmented
            label="Room status"
            value={draft.isActive ? 'live' : 'closed'}
            options={[
              { value: 'live', label: 'Live' },
              { value: 'closed', label: 'Closed' },
            ]}
            onChange={(v) => set({ isActive: v === 'live' })}
          />
          {!draft.isActive && space.isActive && <p className="text-sm text-navy-soft">Closing sends everyone inside back to Spaces{inside ? ` (${inside} now)` : ''}, and the room shows as closed.</p>}
          <Switch label="Allow cameras" on={draft.allowCamera} onChange={(v) => set({ allowCamera: v })} />
          <Switch label="Allow microphones" on={draft.allowMicrophone} onChange={(v) => set({ allowMicrophone: v })} />
        </Section>

        <Section title="Background" hint="JPEG, PNG or WebP. Large images are resized for rooms and stored in Supabase Storage.">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={preparing}>
              {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {draft.backgroundStyle === 'custom' ? 'Replace image' : 'Upload image'}
            </Button>
            {draft.backgroundStyle !== 'default' && (
              <Button type="button" variant="ghost" onClick={() => set({ backgroundStyle: 'default', file: null, preview: null, focusX: 50, focusY: 50 })}>
                <RotateCcw className="h-4 w-4" /> Reset to default
              </Button>
            )}
            {draft.backgroundStyle !== 'none' && (
              <Button type="button" variant="ghost" onClick={() => set({ backgroundStyle: 'none', file: null, preview: null })}>
                <Trash2 className="h-4 w-4" /> Remove image
              </Button>
            )}
          </div>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" aria-label="Background image" data-testid="background-input" onChange={(e) => pick(e.target.files?.[0])} />
          <p className="text-sm text-muted">
            {draft.file ? 'New image ready — save to publish it.' : draft.backgroundStyle === 'custom' ? 'Custom image.' : draft.backgroundStyle === 'none' ? 'No image: a plain PLACES sky.' : 'The default PLACES background for this kind of room.'}
          </p>
          {hasImage && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Range label="Keep in view — across" value={draft.focusX} onChange={(v) => set({ focusX: v })} />
              <Range label="Keep in view — down" value={draft.focusY} onChange={(v) => set({ focusY: v })} />
            </div>
          )}
        </Section>
      </div>

      {/* Live preview on a laptop and a phone */}
      <aside className="grid gap-4 lg:sticky lg:top-[104px]">
        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted">Preview</p>
          <div className="grid grid-cols-[1fr_92px] items-end gap-3">
            <Frame className="aspect-[16/10] rounded-xl" space={previewSpace} onFocus={hasImage ? (x, y) => set({ focusX: x, focusY: y }) : undefined} focus={hasImage ? [draft.focusX, draft.focusY] : undefined} />
            <Frame className="aspect-[9/19] rounded-[18px]" space={previewSpace} />
          </div>
          {hasImage && <p className="mt-2 text-xs text-muted">Tap the large preview to choose what stays in view.</p>}
        </Card>
        <div className="flex gap-2">
          <Button className="flex-1" size="lg" onClick={save} disabled={!dirty || saving || preparing} aria-busy={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
          <Button variant="outline" size="lg" onClick={() => setDraft(draftFrom(space))} disabled={!dirty || saving}>
            Discard
          </Button>
        </div>
        <button onClick={() => router.push(`/myplace/space/?room=${space.slug}`)} className="text-sm font-medium text-teal-deep hover:underline">
          Open the room →
        </button>
      </aside>
    </div>
  )
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Card className="grid gap-4 p-5 md:p-6">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </Card>
  )
}

function Switch({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="flex items-center justify-between gap-4 rounded-2xl bg-ivory px-4 py-3 text-left">
      <span className="font-medium">{label}</span>
      <span className="flex items-center gap-2 text-sm text-muted">
        {on ? 'On' : 'Off'}
        <span className={cn('relative h-6 w-11 rounded-full transition', on ? 'bg-teal' : 'bg-line')}>
          <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'left-[22px]' : 'left-0.5')} />
        </span>
      </span>
    </button>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex w-fit rounded-full bg-ivory p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn('rounded-full px-5 py-2 text-sm font-medium transition', value === o.value ? (o.value === 'closed' ? 'bg-navy text-white shadow-soft' : 'bg-teal text-white shadow-soft') : 'text-navy-soft')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Range({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="flex justify-between text-navy-soft">
        {label} <span className="tabular-nums text-muted">{value}%</span>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="accent-teal" />
    </label>
  )
}

function Frame({ space, className, onFocus, focus }: { space: Parameters<typeof RoomBackdrop>[0]['space']; className?: string; onFocus?: (x: number, y: number) => void; focus?: [number, number] }) {
  return (
    <div
      className={cn('relative overflow-hidden bg-navy ring-4 ring-navy/90', onFocus && 'cursor-crosshair', className)}
      onClick={(e) => {
        if (!onFocus) return
        const r = e.currentTarget.getBoundingClientRect()
        onFocus(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100))
      }}
    >
      <RoomBackdrop space={space} />
      <div className="absolute inset-0 flex items-center justify-center gap-[6%]" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="aspect-square w-[16%] rounded-full bg-gradient-to-br from-aqua to-teal-deep shadow-lg ring-2 ring-white/90" style={{ transform: `translateY(${[-12, 10, -4][i]}%)` }} />
        ))}
      </div>
      {focus && <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-teal shadow" style={{ left: `${focus[0]}%`, top: `${focus[1]}%` }} />}
    </div>
  )
}
