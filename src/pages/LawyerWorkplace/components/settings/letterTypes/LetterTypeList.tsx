import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig } from '../../../settings/types'
import { getLetterTypeName } from '../letterTypeDisplay'
import { LetterTypeDot } from '../LetterTypeDot'

interface LetterTypeListProps {
  letterTypes: LetterTypeConfig[]
  selectedId: string
  onSelect: (id: string) => void
  onAddType: () => void
  readOnly?: boolean
}

export function LetterTypeList({
  letterTypes,
  selectedId,
  onSelect,
  onAddType,
  readOnly = false,
}: LetterTypeListProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex min-h-0 flex-col overflow-y-hidden rounded-[12px] border border-gray-100 bg-white">
      <div className="border-light-100 flex items-center justify-between gap-2 border-b px-[14px] py-3">
        <h2 className="text-dark-500 text-[13px] font-medium">
          {t('pages.lawyerWorkplace.settings.letterTypes.listTitle', 'Letter types')}
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={onAddType}
            className="bg-primary-300 text-dark-500 hover:bg-primary-400 inline-flex items-center gap-1 rounded px-3 py-1.5 text-[11px] font-medium transition-colors"
          >
            <Icons.Add size={14} strokeWidth={2} />
            {t('pages.lawyerWorkplace.settings.addType', 'Add type')}
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {letterTypes.length === 0 ? (
          <p className="text-light-600 px-4 py-10 text-center text-sm">
            {t(
              'pages.lawyerWorkplace.settings.letterTypes.empty',
              'No letter types yet. Add the first type to configure classification.'
            )}
          </p>
        ) : null}
        {letterTypes.map((letterType) => {
          const isSelected = letterType.id === selectedId
          return (
            <button
              key={letterType.id}
              type="button"
              onClick={() => onSelect(letterType.id)}
              className={cn(
                'flex w-full cursor-pointer items-center gap-3 border-l-3 border-white px-3 py-3 text-left transition-colors',
                isSelected ? 'bg-primary-50 border-primary-500 border-l-3' : 'hover:bg-white/70'
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <LetterTypeDot colorId={letterType.colorId} />
                  <p className="text-dark-500 truncate text-[13px] font-medium">
                    {getLetterTypeName(letterType, t)}
                  </p>
                </div>
                <p className="text-light-600 truncate text-[11px]">
                  {t('pages.lawyerWorkplace.settings.letterTypes.listMeta', {
                    sla: letterType.slaDays,
                    examples: letterType.examples.length,
                    defaultValue: `SLA ${letterType.slaDays} b.d. • ${letterType.examples.length} examples`,
                  })}
                </p>
              </div>
              <span
                className={cn(
                  'text-secondary-900 flex items-center justify-center rounded-full px-2 text-[11px] font-normal',
                  !isSelected ? 'bg-light-100' : 'bg-white'
                )}
              >
                {letterType.letterCount}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
