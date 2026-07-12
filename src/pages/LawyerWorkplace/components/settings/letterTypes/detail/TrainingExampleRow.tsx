import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { TrainingExample } from '../../../../settings/types'

interface TrainingExampleRowProps {
  example: TrainingExample
  onClick?: () => void
  onRemove?: () => void
}

export function TrainingExampleRow({ example, onClick, onRemove }: TrainingExampleRowProps) {
  const { t } = useTranslation('common')
  const title = t(example.titleKey, example.titleFallback)
  const body = t(example.bodyKey, example.bodyFallback)
  const source = t(example.sourceKey, example.sourceFallback)

  const content = (
    <>
      <p className="text-secondary-900 min-w-0 flex-1 text-[13px] leading-snug">
        <span className="font-semibold">{title}</span>
        <span className="font-light"> — </span>
        <span className="font-light">{body}</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-light-600 text-[11px] whitespace-nowrap">{source}</span>
        {onRemove ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onRemove()
            }}
            className="text-light-500 hover:text-dark-500 p-0.5"
            aria-label={t('actions.remove', 'Remove')}
          >
            <Icons.Cancel01 size={14} strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </>
  )

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            onClick()
          }
        }}
        className={cn(
          'flex w-full cursor-pointer items-start gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3 text-left',
          'hover:border-secondary-200 focus-visible:ring-primary-400 hover:bg-[#FAFAF8] focus-visible:ring-2 focus-visible:outline-none'
        )}
      >
        {content}
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4 rounded-xl border border-gray-100 bg-white px-4 py-3">
      {content}
    </div>
  )
}
