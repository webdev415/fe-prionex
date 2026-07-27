import { cn } from '@/lib/utils'
import type { RegistryLetterType } from '@/features/lawyerWorkplace'
import { LETTER_TYPE_COLOR_BY_ID } from '../settings/constants'

interface RegistryCategoryBadgeProps {
  letterType: RegistryLetterType
  className?: string
}

/**
 * Category pill for correspondence-registry rows. Unlike the settings
 * `LetterTypeBadge` (which resolves an i18n key), the registry serves the
 * category name literally, so it is rendered as-is with the letter-type colour.
 */
export function RegistryCategoryBadge({ letterType, className }: RegistryCategoryBadgeProps) {
  const color = LETTER_TYPE_COLOR_BY_ID[letterType.color_id] ?? LETTER_TYPE_COLOR_BY_ID.teal!

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
        color.bgClass,
        color.textClass,
        className
      )}
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', color.dotClass)} />
      {letterType.name}
    </span>
  )
}
