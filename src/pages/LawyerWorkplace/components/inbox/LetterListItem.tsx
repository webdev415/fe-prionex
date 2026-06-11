import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatLetterTime } from '../../utils/formatters'
import type { LetterListItem as LetterListItemType } from '../../types'

const STATUS_KEYS: Record<LetterListItemType['status'], { labelKey: string; className: string }> = {
  new: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.new',
    className: 'bg-error-100 text-error-700',
  },
  in_progress: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.inProgress',
    className: 'bg-secondary-100 text-secondary-800',
  },
  on_board: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.onBoard',
    className: 'bg-warning-100 text-warning-700',
  },
  sent_to_kanban: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.sentToKanban',
    className: 'bg-blue-100 text-blue-500',
  },
  auto_processed: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.autoProcessed',
    className: 'bg-gray-100 text-gray-600',
  },
}

const TYPE_COLOUR: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-[#EDE9FE] text-[#6D28D9]',
  inquiry: 'bg-success-100 text-success-700',
}

export interface LetterListItemProps {
  letter: LetterListItemType
  isSelected: boolean
  onSelect: (letterId: string) => void
}

export function LetterListItem({ letter, isSelected, onSelect }: LetterListItemProps) {
  const { t, i18n } = useTranslation('common')
  const status = STATUS_KEYS[letter.status]
  const typeColour = letter.letterType
    ? (TYPE_COLOUR[letter.letterType] ?? 'bg-gray-100 text-gray-600')
    : null

  return (
    <button
      type="button"
      onClick={() => onSelect(letter.id)}
      className={cn(
        'relative mx-3 my-2 w-[calc(100%-24px)] rounded-[12px] border p-3.5 text-left transition-colors',
        isSelected
          ? 'border-primary-500 bg-primary-50'
          : letter.isUnprocessed
            ? 'bg-error-50 hover:bg-error-100/60 border-white'
            : 'border-white bg-white hover:bg-gray-50/40'
      )}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-dark-500 min-w-0 truncate text-[13px] leading-tight font-medium">
          {letter.senderName}
        </span>
        <span className="text-light-700 shrink-0 text-[11px]">
          {formatLetterTime(letter.receivedAt, t, i18n.language)}
        </span>
      </div>

      <div className="mb-0.5 flex items-start gap-2">
        <p className="text-light-700 flex min-w-0 flex-1 flex-wrap text-[11.5px] leading-snug">
          <span className="inline-flex items-center whitespace-nowrap">
            <span>{letter.senderEmail}</span>
            <span
              className="text-light-700 inline-flex items-baseline px-0.5 py-0.5 align-baseline"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
          </span>
          <span>{letter.mailbox}</span>
        </p>

        {status && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide whitespace-nowrap uppercase',
              status.className
            )}
          >
            {t(status.labelKey)}
          </span>
        )}
      </div>

      <p className="text-dark-500 mt-2 mb-2 line-clamp-2 text-[12.5px] leading-snug">
        {letter.subject}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        {typeColour ? (
          <span
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              typeColour
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            <span>{letter.letterTypeLabel}</span>
          </span>
        ) : (
          <span className="bg-light-100 border-dotted-[1px] text-light-700 flex items-center gap-1 rounded-full border-gray-200 px-2 py-0.5 text-[10.5px] font-medium">
            <span className="bg-light-700 h-1.5 w-1.5 rounded-full" />
            <span>{t('pages.lawyerWorkplace.letterItem.unclassified', 'Unclassified')}</span>
          </span>
        )}

        {letter.clientCode && letter.clientName ? (
          <div className="flex items-center gap-1">
            <span className="text-dark-500 text-[11px]">{letter.clientName}</span>
            <span className="text-light-700 text-[11px]"> · </span>
            <span className="text-light-700 text-[11px]">{letter.clientCode}</span>
          </div>
        ) : (
          <em className="text-error-700 text-[11px] italic">
            {t('pages.lawyerWorkplace.letterItem.unidentified', 'unidentified')}
          </em>
        )}
      </div>
    </button>
  )
}
