import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'
import type { LawyerPriorityRole } from '../../../../settings/types'
import { PRIORITY_ROLE_OPTIONS } from '../../constants'

interface LawyerRoleBadgeProps {
  role: LawyerPriorityRole
  onSelect: (role: LawyerPriorityRole) => void
}

export function LawyerRoleBadge({ role, onSelect }: LawyerRoleBadgeProps) {
  const { t } = useTranslation('common')
  const activeOption =
    PRIORITY_ROLE_OPTIONS.find((option) => option.id === role) ?? PRIORITY_ROLE_OPTIONS[3]!

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'min-w-[88px] cursor-pointer rounded-full border px-3 py-1.5 text-[10px] font-semibold tracking-wide',
            activeOption.activeClass
          )}
        >
          {t(activeOption.labelKey, activeOption.fallback)}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[120px]">
        {PRIORITY_ROLE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.id}
            className="cursor-pointer text-[12px]"
            onClick={() => onSelect(option.id)}
          >
            {t(option.labelKey, option.fallback)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
