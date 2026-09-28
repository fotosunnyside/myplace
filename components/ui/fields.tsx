'use client'

import Image from 'next/image'
import { ImagePlus, X } from 'lucide-react'
import { useId, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { fileToDataUrl } from '@/lib/image'
import { toast } from '@/lib/ui'
import { cn } from '@/lib/cn'

const control =
  'w-full rounded-2xl border border-line bg-white px-4 text-[0.95rem] text-navy outline-none transition placeholder:text-muted focus:border-teal/60 focus:shadow-[0_0_0_4px_rgb(18_170_168/0.12)]'

function Label({ id, label, hint, children }: { id: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-navy">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  )
}

export function TextField({ label, hint, className, ...props }: ComponentProps<'input'> & { label: string; hint?: ReactNode }) {
  const id = useId()
  return (
    <Label id={id} label={label} hint={hint}>
      <input id={id} className={cn(control, 'h-12', className)} {...props} />
    </Label>
  )
}

export function TextArea({ label, hint, className, ...props }: ComponentProps<'textarea'> & { label: string; hint?: ReactNode }) {
  const id = useId()
  return (
    <Label id={id} label={label} hint={hint}>
      <textarea id={id} rows={4} className={cn(control, 'resize-y py-3 leading-relaxed', className)} {...props} />
    </Label>
  )
}

export function Select({ label, hint, options, className, ...props }: ComponentProps<'select'> & { label: string; hint?: ReactNode; options: string[] }) {
  const id = useId()
  return (
    <Label id={id} label={label} hint={hint}>
      <select id={id} className={cn(control, 'h-12 appearance-none bg-[url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%228%22><path d=%22M1 1l5 5 5-5%22 stroke=%22%23123B4A%22 fill=%22none%22 stroke-width=%221.6%22/></svg>")] bg-[position:right_1rem_center] bg-no-repeat pr-10', className)} {...props}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </Label>
  )
}

/** Picks an image, downsizes it in the browser and hands back a data URL. */
export function ImagePicker({
  label,
  value,
  onChange,
  shape = 'wide',
}: {
  label: string
  value?: string
  onChange: (v: string | undefined) => void
  shape?: 'wide' | 'round' | 'square'
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()

  const pick = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      onChange(await fileToDataUrl(file, shape === 'round' ? 512 : 1400))
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const frame = shape === 'round' ? 'h-24 w-24 shrink-0 rounded-full' : shape === 'square' ? 'aspect-square w-40 shrink-0 rounded-2xl' : 'aspect-[16/9] min-w-0 flex-1 rounded-2xl'

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-navy">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => input.current?.click()}
          aria-describedby={id}
          className={cn('group relative grid place-items-center overflow-hidden border border-dashed border-teal/40 bg-teal-wash/50 text-teal-deep transition hover:bg-teal-wash', frame)}
        >
          {value ? (
            <Image src={value} alt="Selected image" fill unoptimized className="object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs font-medium">
              <ImagePlus className="h-6 w-6" />
              {busy ? 'Preparing…' : 'Add photo'}
            </span>
          )}
        </button>
        {value && (
          <button type="button" onClick={() => onChange(undefined)} className="inline-flex shrink-0 items-center gap-1 text-sm text-muted hover:text-navy">
            <X className="h-4 w-4" /> Remove
          </button>
        )}
      </div>
      <p id={id} className="sr-only">
        Opens your photo library
      </p>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  )
}

export function ChipPicker({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium text-navy">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
              className={cn(
                'rounded-full border px-3.5 py-1.5 text-sm transition',
                on ? 'border-teal bg-teal text-white' : 'border-line bg-white text-navy-soft hover:border-teal/40',
              )}
            >
              {o}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
