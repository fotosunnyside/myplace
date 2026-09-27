import type { Metadata } from 'next'
import { Avatar, Card, Tag } from '@/components/ui/primitives'

export const metadata: Metadata = { title: 'Messages' }

const threads = [
  { name: 'Maya Chen', avatar: '/media/avatar-a.webp', place: 'MarketPlace', tone: 'coral' as const, preview: 'The mug set ships Monday — thank you so much!', ago: '12m', unread: true },
  { name: 'Leo Hart', avatar: '/media/avatar-b.webp', place: 'MindPlace', tone: 'lavender' as const, preview: 'Want to co-host the composting live session?', ago: '1h', unread: true },
  { name: 'Ana Ruiz', avatar: '/media/avatar-c.webp', place: 'WorkPlace', tone: 'teal' as const, preview: 'Loved your portfolio. Are you free for a quick call?', ago: '3h', unread: false },
]

export default function MessagesPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-[calc(80px+env(safe-area-inset-top))] md:pb-20 md:pt-[108px]">
      <h1 className="font-serif text-4xl">Messages</h1>
      <p className="mt-1 text-sm text-muted">One inbox across every Place.</p>
      <ul className="mt-6 grid gap-3">
        {threads.map((t) => (
          <li key={t.name}>
            <Card lift className="flex items-center gap-4 p-4">
              <Avatar src={t.avatar} alt="" size={48} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-semibold">{t.name}</p>
                  <Tag tone={t.tone}>{t.place}</Tag>
                </div>
                <p className={`truncate text-sm ${t.unread ? 'text-navy' : 'text-muted'}`}>{t.preview}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className="text-xs text-muted">{t.ago}</span>
                {t.unread && <span className="h-2.5 w-2.5 rounded-full bg-teal" aria-label="Unread" />}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </main>
  )
}
