import type { ReactNode } from 'react'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'

interface TrainingSearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
}

export function TrainingSearchBar({ value, onChange, placeholder }: TrainingSearchBarProps) {
  return (
    <div className="relative">
      <Icons.Search size={14} className="absolute top-1/2 left-3 -translate-y-1/2 text-[#676767]" />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-[240px] rounded-lg border-[#DFDFDF] bg-white pl-9 text-xs"
      />
    </div>
  )
}

interface TrainingPrimaryButtonProps {
  children: ReactNode
  onClick?: () => void
  leftIcon?: ReactNode
}

export function TrainingPrimaryButton({ children, onClick, leftIcon }: TrainingPrimaryButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-md bg-[#204E4D] px-4 text-xs font-medium text-white transition-colors hover:bg-[#1a3f3e]"
    >
      {leftIcon}
      {children}
    </button>
  )
}

interface TrainingFilterChipsProps {
  items: { id: string; label: string }[]
  activeId: string
  onChange: (id: string) => void
}

/** Secondary category/type filter row — inactive white pills, active `#204E4D`. */
export function TrainingFilterChips({ items, activeId, onChange }: TrainingFilterChipsProps) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#EBECE8] bg-white p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      {items.map((item) => {
        const isActive = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium tracking-[-0.02em] transition-colors ${
              isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
