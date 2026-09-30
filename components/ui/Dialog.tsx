'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** Bottom sheet on phones, centered card on larger screens. */
export function Dialog({ open, onClose, title, description, children, className }: DialogProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Focus the first field once the panel is in — unless the person has already clicked into one,
    // which would otherwise yank the cursor back mid-typing.
    const t = setTimeout(() => {
      if (panel.current?.contains(document.activeElement)) return
      panel.current?.querySelector<HTMLElement>('input, textarea, select, button[data-autofocus]')?.focus()
    }, 60)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      prev?.focus?.()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center md:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 bg-navy/30 backdrop-blur-[3px]" />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}
            className={cn(
              'pb-safe relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] bg-cream shadow-lift md:max-w-lg md:rounded-[28px]',
              className,
            )}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-cream/95 px-6 pb-3 pt-5 backdrop-blur">
              <div>
                <h2 id={titleId} className="font-serif text-2xl leading-tight text-navy">
                  {title}
                </h2>
                {description && <p className="mt-1 text-sm text-muted">{description}</p>}
              </div>
              <button onClick={onClose} aria-label="Close" className="-mr-2 grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-navy/5">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 pb-6">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
