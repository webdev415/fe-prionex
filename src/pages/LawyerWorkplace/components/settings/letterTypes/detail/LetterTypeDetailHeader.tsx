import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../../settings/types'
import { LETTER_TYPE_COLOR_BY_ID } from '../../constants'
import { getLetterTypeName } from '../../letterTypeDisplay'

interface LetterTypeDetailHeaderProps {
  draft: LetterTypeConfig
}

export function LetterTypeDetailHeader({ draft }: LetterTypeDetailHeaderProps) {
  const { t } = useTranslation('common')
  const color = LETTER_TYPE_COLOR_BY_ID[draft.colorId] ?? LETTER_TYPE_COLOR_BY_ID.teal!

  return (
    <div className="border-b border-gray-100 px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-dark-500 text-base font-normal">{getLetterTypeName(draft, t)}</h2>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
            color.bgClass,
            color.textClass
          )}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', color.dotClass)} />
          {draft.slug}
        </span>
      </div>
    </div>
  )
}
