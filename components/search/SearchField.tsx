import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

interface SearchFieldProps {
  placeholder: string
  className?: string
  size?: 'sm' | 'md' | 'lg'
  name?: string
}

export function SearchField({ placeholder, className, size = 'md', name = 'q' }: SearchFieldProps) {
  return (
    <form role="search" action="/explore" className={cn('group relative', className)}>
      <Search
        aria-hidden
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 text-navy-soft transition-colors group-focus-within:text-teal',
          size === 'sm' ? 'left-3.5 h-3.5 w-3.5' : 'left-4 h-[18px] w-[18px]',
        )}
      />
      <input
        type="search"
        name={name}
        aria-label={placeholder.replace(/\.+$/, '')}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-full border border-line/80 bg-white/85 text-navy shadow-[inset_0_1px_2px_rgb(18_59_74/0.03)] outline-none transition duration-300 ease-gentle placeholder:text-muted',
          'focus:border-teal/50 focus:bg-white focus:shadow-[0_0_0_4px_rgb(18_170_168/0.12)]',
          size === 'sm' && 'h-9 pl-9 pr-4 text-[0.72rem]',
          size === 'md' && 'h-11 pl-11 pr-5 text-sm',
          size === 'lg' && 'h-12 pl-12 pr-5 text-[0.95rem]',
        )}
      />
    </form>
  )
}
