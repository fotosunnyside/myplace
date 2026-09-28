'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertCircle } from 'lucide-react'
import { useEffect } from 'react'
import { hydrate } from '@/lib/store/store'
import { initBackendAuth } from '@/lib/backend/auth'
import { RoomPill } from '@/components/spaces/RoomPill'
import { useToasts } from '@/lib/ui'
import { cn } from '@/lib/cn'
import { AuthDialog } from './AuthDialog'
import { CreateDialogs } from './CreateDialogs'

/** Loads this device's world and mounts app-wide dialogs and toasts. */
export function AppProviders() {
  useEffect(() => {
    hydrate()
    initBackendAuth()
  }, [])

  return (
    <>
      <AuthDialog />
      <CreateDialogs />
      <RoomPill />
      <Toaster />
    </>
  )
}

function Toaster() {
  const toasts = useToasts()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-[80] flex flex-col items-center gap-2 px-4 md:bottom-8">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
            className={cn(
              'pointer-events-auto flex max-w-md items-center gap-2.5 rounded-full px-5 py-3 text-sm font-medium shadow-lift',
              t.tone === 'error' ? 'bg-[#fff1ee] text-[#a2412c] ring-1 ring-coral/40' : 'bg-navy text-white',
            )}
          >
            {t.tone === 'error' ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0 text-aqua" />}
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
