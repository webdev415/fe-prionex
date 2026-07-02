import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../../settings/types'
import { LETTER_TYPE_COLOR_BY_ID } from '../../constants'
import { getLetterTypeName } from '../../letterTypeDisplay'

interface LetterTypeDetailHeaderProps {
  draft: LetterTypeConfig
  onBack?: () => void
  onDelete?: () => void
  canDelete?: boolean
  isDeleting?: boolean
}

export function LetterTypeDetailHeader({
  draft,
  onBack,
  onDelete,
  canDelete = true,
  isDeleting = false,
}: LetterTypeDetailHeaderProps) {
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

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
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

        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete || isDeleting}
            title={
              canDelete
                ? t('pages.lawyerWorkplace.settings.letterTypes.deleteType', 'Delete letter type')
                : t(
                    'pages.lawyerWorkplace.settings.letterTypes.deleteTypeLastWarning',
                    'At least one letter type must remain.'
                  )
            }
            aria-label={t(
              'pages.lawyerWorkplace.settings.letterTypes.deleteType',
              'Delete letter type'
            )}
            className={cn(
              'text-light-500 hover:text-error-600 flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-red-50',
              (!canDelete || isDeleting) &&
                'hover:text-light-500 cursor-not-allowed opacity-40 hover:bg-transparent'
            )}
          >
            <Icons.Delete size={18} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  )
}
