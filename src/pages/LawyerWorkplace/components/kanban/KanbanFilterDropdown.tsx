import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface KanbanFilterDropdownProps {
  value: string
  options: string[]
  onChange: (value: string) => void
}

export function KanbanFilterDropdown({ value, options, onChange }: KanbanFilterDropdownProps) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="text-dark-500 flex h-[38px] w-[230px] max-w-[270px] items-center justify-between gap-2 rounded-[8px] border border-gray-200 bg-white px-3 text-[12px] font-normal hover:bg-gray-50"
        >
          <span className="min-w-0 truncate text-left">{value}</span>
          <Icons.ArrowDown size={14} strokeWidth={1.5} className="shrink-0 text-gray-400" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-[var(--radix-dropdown-menu-trigger-width)] p-1"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-1.5 text-[13px]',
              opt === value && 'bg-gray-50 font-medium'
            )}
            onClick={() => onChange(opt)}
          >
            {opt}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
