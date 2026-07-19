import type { ReactNode } from 'react'
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
  align?: 'start' | 'center' | 'end'
  collisionPadding?: number
  renderOption?: (option: KanbanFilterOption<T>) => ReactNode
  renderValue?: (option: KanbanFilterOption<T>) => ReactNode
}

function defaultLabel<T extends string>(
  option: KanbanFilterOption<T>,
  t: (key: string, fallback: string) => string
): ReactNode {
  if (option.label) return option.label
  return t(option.key, option.fallback)
}

export function KanbanFilterDropdown<T extends string>({
  value,
  options,
  onChange,
  className,
  align = 'end',
  collisionPadding = 12,
  renderOption,
  renderValue,
}: KanbanFilterDropdownProps<T>) {
  const { t } = useTranslation('common')
  const selected = options.find((option) => option.id === value) ?? options[0]!

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'text-dark-500 border-border bg-input flex h-[38px] w-full items-center justify-between gap-2 rounded-[8px] border px-3 text-[12px] font-normal hover:bg-gray-50',
            className
          )}
        >
          <span className="flex min-w-0 flex-1 items-center truncate text-left">
            {renderValue ? renderValue(selected) : defaultLabel(selected, t)}
          </span>
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side="bottom"
        sideOffset={4}
        collisionPadding={collisionPadding}
        className="max-h-60 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1"
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
            {renderOption ? renderOption(option) : defaultLabel(option, t)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
