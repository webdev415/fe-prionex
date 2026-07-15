import type { TFunction } from 'i18next'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../settings/types'
import { LETTER_TYPE_COLOR_BY_ID } from './constants'

interface LetterTypeBadgeProps {
  letterType: Pick<LetterTypeConfig, 'colorId' | 'nameKey' | 'nameFallback'>
  t: TFunction
  size?: 'sm' | 'md'
  className?: string
}

export function LetterTypeBadge({ letterType, t, size = 'sm', className }: LetterTypeBadgeProps) {
  const color = LETTER_TYPE_COLOR_BY_ID[letterType.colorId] ?? LETTER_TYPE_COLOR_BY_ID.teal!

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
        color.bgClass,
        color.textClass,
        className
      )}
    >
      <span
        className={cn('rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2', color.dotClass)}
      />
      {t(letterType.nameKey, letterType.nameFallback)}
    </span>
  )
}
