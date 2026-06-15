import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../../settings/types'
import { LETTER_TYPE_COLOR_BY_ID } from '../../constants'
import { getLetterTypeName } from '../../letterTypeDisplay'

interface LetterTypeDetailHeaderProps {
  draft: LetterTypeConfig
  onBack?: () => void
}

export function LetterTypeDetailHeader({ draft, onBack }: LetterTypeDetailHeaderProps) {
  const { t } = useTranslation('common')
  const color = LETTER_TYPE_COLOR_BY_ID[draft.colorId] ?? LETTER_TYPE_COLOR_BY_ID.teal!

  return (
    <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="text-light-600 hover:text-dark-500 mb-3 inline-flex items-center gap-1.5 text-[12px] font-medium"
        >
          <Icons.ArrowLeft02 size={14} strokeWidth={1.5} />
          {t('actions.back', 'Back')}
        </button>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
