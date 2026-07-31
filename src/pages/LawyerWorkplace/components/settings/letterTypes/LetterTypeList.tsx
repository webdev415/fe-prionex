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
  const isEmpty = letterTypes.length === 0

  return (
    <div
      className={cn(
        'bg-card border-border flex min-h-0 flex-col overflow-y-hidden rounded-[12px] border',
        isEmpty && 'min-h-[420px]'
      )}
    >
      <div className="border-border flex items-center justify-between gap-2 border-b px-[14px] py-3">
        <h2 className="text-foreground text-[13px] font-medium">
          {t('pages.lawyerWorkplace.settings.letterTypes.listTitle', 'Letter types')}
        </h2>
        {!readOnly && (
          <button
            type="button"
            onClick={onAddType}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-1 rounded px-3 py-1.5 text-[11px] font-medium transition-colors"
          >
            <Icons.Add size={14} strokeWidth={2} />
            {t('pages.lawyerWorkplace.settings.addType', 'Add type')}
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 py-14 text-center">
          <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.Tag01 size={22} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <p className="text-foreground text-[14px] font-medium">
            {t('pages.lawyerWorkplace.settings.letterTypes.empty.title', 'No letter types yet')}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.letterTypes.empty.description',
              'Add the first type to configure classification, SLA, and lawyer priorities.'
            )}
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {letterTypes.map((letterType) => {
            const isSelected = letterType.id === selectedId
            const savedExampleCount = letterType.examples.filter(
              (example) => !example.isPlaceholder
            ).length
            return (
              <button
                key={letterType.id}
                type="button"
                onClick={() => onSelect(letterType.id)}
                className={cn(
                  'border-border flex w-full cursor-pointer items-center gap-3 border-l-3 px-3 py-3 text-left transition-colors',
                  isSelected ? 'bg-primary/10 border-primary-500 border-l-3' : 'hover:bg-muted'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <LetterTypeDot colorId={letterType.colorId} />
                    <p className="text-foreground truncate text-[13px] font-medium">
                      {getLetterTypeName(letterType, t)}
                    </p>
                  </div>
                  <p className="text-muted-foreground truncate text-[11px]">
                    {t('pages.lawyerWorkplace.settings.letterTypes.listMeta', {
                      sla: letterType.slaDays,
                      examples: savedExampleCount,
                      defaultValue: `SLA ${letterType.slaDays} b.d. • ${savedExampleCount} examples`,
                    })}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-foreground flex items-center justify-center rounded-full px-2 text-[11px] font-normal',
                    !isSelected ? 'bg-muted' : 'bg-muted/80'
                  )}
                >
                  {letterType.letterCount}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
