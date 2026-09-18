import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatLetterTime } from '../../utils/formatters'
import type { LetterListItem as LetterListItemType } from '../../types'
import { piiProps } from '@/lib/openreplay/pii'

const STATUS_KEYS: Record<
  'new' | 'in_progress' | 'auto_processed' | 'done',
  { labelKey: string; className: string }
> = {
  new: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.new',
    className: 'bg-error-100 text-error-700',
  },
  in_progress: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.inProgress',
    className: 'bg-secondary-100 text-secondary-800',
  },
  auto_processed: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.autoProcessed',
    className: 'bg-success-100 text-success-700',
  },
  done: {
    labelKey: 'pages.lawyerWorkplace.letterItem.status.done',
    className: 'bg-blue-100 text-blue-500',
  },
}

const TYPE_COLOUR: Record<string, string> = {
  complaint: 'bg-error-100 text-error-700',
  nbu_inquiry: 'bg-secondary-100 text-secondary-800',
  court_claim: 'bg-warning-100 text-warning-700',
  attorney_request: 'bg-violet-100 text-violet-700',
  inquiry: 'bg-success-100 text-success-700',
}

export interface LetterListItemProps {
  letter: LetterListItemType
  isSelected: boolean
  onSelect: (letterId: string) => void
}

export function LetterListItem({ letter, isSelected, onSelect }: LetterListItemProps) {
  const { t, i18n } = useTranslation('common')
  const navigate = useNavigate()
  const displayStatus = letter.status
  const status = STATUS_KEYS[displayStatus]
  const typeColour = letter.letterType
    ? (TYPE_COLOUR[letter.letterType] ?? 'bg-muted text-muted-foreground')
    : null

  const isAutoProcessed = displayStatus === 'auto_processed'
  const isDone = displayStatus === 'done'

  return (
    <button
      type="button"
      onClick={() => onSelect(letter.id)}
      className={cn(
        'relative mx-3 my-2 w-[calc(100%-24px)] rounded-[12px] border p-3.5 text-left transition-colors',
        isSelected
          ? 'border-primary-500 bg-primary/10'
          : letter.isUnprocessed
            ? 'border-l-warning-400 border-border bg-warning-100/60 hover:bg-warning-100/40 border-l-2'
            : isAutoProcessed
              ? 'border-success-100 bg-success-50/30 hover:bg-success-50/60'
              : isDone
                ? 'border-border bg-muted/80 hover:bg-muted'
                : 'border-card bg-card hover:bg-muted/40'
      )}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span
          className="text-foreground min-w-0 truncate text-[13px] leading-tight font-medium"
          {...piiProps}
        >
          {letter.senderName}
        </span>
        <span className="text-muted-foreground shrink-0 text-[11px]">
          {formatLetterTime(letter.receivedAt, t, i18n.language)}
        </span>
      </div>

      <div className="mb-0.5 flex items-start gap-2">
        <p className="text-muted-foreground flex min-w-0 flex-1 flex-wrap text-[11.5px] leading-snug">
          <span className="inline-flex items-center whitespace-nowrap">
            <span>{letter.routeFromEmail}</span>
            <span
              className="text-muted-foreground inline-flex items-baseline px-0.5 py-0.5 align-baseline"
              aria-hidden="true"
            >
              <Icons.ArrowRight02 size={10} strokeWidth={1.5} />
            </span>
          </span>
          <span>{letter.routeToEmail}</span>
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

      <p
        className="text-foreground mt-2 mb-2 line-clamp-2 text-[12.5px] leading-snug"
        {...piiProps}
      >
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
          <span className="bg-muted border-dotted-[1px] text-muted-foreground border-border flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium">
            <span className="bg-muted-foreground h-1.5 w-1.5 rounded-full" />
            <span>{t('pages.lawyerWorkplace.letterItem.unclassified', 'Unclassified')}</span>
          </span>
        )}

        {isAutoProcessed && (
          <span
            className="bg-success-500 ml-1 inline-block h-1.5 w-1.5 rounded-full"
            aria-hidden="true"
          />
        )}

        {letter.clientCode ? (
          // This item is itself a <button>, so the client link can't be a nested
          // <a>; use a role="link" span that navigates to the client card and
          // stops the click from also selecting the letter.
          letter.clientId ? (
            <span
              role="link"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/dashboard/clients/${letter.clientId}`)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation()
                  navigate(`/dashboard/clients/${letter.clientId}`)
                }
              }}
              className="flex cursor-pointer items-center gap-1 hover:underline"
              title={t('pages.lawyerWorkplace.openClientCard', 'Open client card')}
            >
              {letter.clientName ? (
                <>
                  <span className="text-foreground text-[11px]" {...piiProps}>
                    {letter.clientName}
                  </span>
                  <span className="text-muted-foreground text-[11px]"> · </span>
                </>
              ) : null}
              <span className="text-muted-foreground text-[11px]">{letter.clientCode}</span>
            </span>
          ) : (
            <div className="flex items-center gap-1">
              {letter.clientName ? (
                <>
                  <span className="text-foreground text-[11px]" {...piiProps}>
                    {letter.clientName}
                  </span>
                  <span className="text-muted-foreground text-[11px]"> · </span>
                </>
              ) : null}
              <span className="text-muted-foreground text-[11px]">{letter.clientCode}</span>
            </div>
          )
        ) : (
          <em className="text-error-700 text-[11px] italic">
            {t('pages.lawyerWorkplace.letterItem.unidentified', 'unidentified')}
          </em>
        )}
      </div>
    </button>
  )
}
