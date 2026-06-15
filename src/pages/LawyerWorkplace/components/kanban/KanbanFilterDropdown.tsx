import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { KanbanFilterOption } from './constants'

interface KanbanFilterDropdownProps<T extends string> {
  value: T
  options: KanbanFilterOption<T>[]
  onChange: (value: T) => void
  className?: string
}

export function KanbanFilterDropdown<T extends string>({
  value,
  options,
  onChange,
  className,
}: KanbanFilterDropdownProps<T>) {
  const { t } = useTranslation('common')
  const selected = options.find((option) => option.id === value) ?? options[0]!

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-dark-500 flex h-[38px] w-full items-center justify-between gap-2 rounded-[8px] border border-gray-200 bg-white px-3 text-[12px] font-normal hover:bg-gray-50',
            className
          )}
        >
          <span className="min-w-0 truncate text-left">{t(selected.key, selected.fallback)}</span>
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-60 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1"
      >
        {options.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]',
              option.id === value && 'bg-gray-50 font-medium'
            )}
            onClick={() => onChange(option.id)}
          >
            {t(option.key, option.fallback)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
