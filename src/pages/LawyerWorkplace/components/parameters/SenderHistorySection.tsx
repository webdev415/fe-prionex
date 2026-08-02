import { useTranslation } from 'react-i18next'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { useLegalSenderHistory } from '@/features/lawyerWorkplace'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { formatLetterTime } from '../../utils/formatters'

export interface SenderHistorySectionProps {
  /** Id of the letter currently open in the panel. */
  messageId: string
  /** Opens another letter (from the same sender) in the workplace. */
  onOpenLetter?: (letterId: string) => void
}

/**
 * Shows how many times the current sender's address has written in ("N-th of M
 * letters from this address") and lets the lawyer jump to any earlier letter
 * from the same address. Backed by GET /legal/messages/{id}/sender-history.
 */
export function SenderHistorySection({ messageId, onOpenLetter }: SenderHistorySectionProps) {
  const { t, i18n } = useTranslation('common')
  const { data, isLoading } = useLegalSenderHistory(messageId)

  if (isLoading || !data) {
    return null
  }

  const { total, position, items } = data
  const isSingle = total <= 1

  const label = isSingle
    ? t('pages.lawyerWorkplace.senderHistory.single', 'First letter from this address')
    : t('pages.lawyerWorkplace.senderHistory.position', {
        position,
        total,
        defaultValue: `Letter {{position}} of {{total}} from this address`,
      })

  const trigger = (
    <span
      className={cn(
        'flex w-full items-center justify-between gap-2 rounded-[8px] border px-3 py-2 text-left text-[12.5px]',
        isSingle
          ? 'border-border bg-muted/40 text-muted-foreground'
          : 'border-secondary-200 bg-secondary-50/60 text-secondary-900 hover:bg-secondary-100/70'
      )}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icons.Clock01 size={15} strokeWidth={1.5} className="shrink-0" />
        <span className="truncate font-medium">{label}</span>
      </span>
      {!isSingle && (
        <Icons.ArrowDown size={15} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
      )}
    </span>
  )

  if (isSingle) {
    return (
      <div className="flex w-full flex-col items-start gap-1.5">
        <span className="text-foreground text-[12px] font-normal">
          {t('pages.lawyerWorkplace.senderHistory.label', 'Address history')}
        </span>
        {trigger}
      </div>
    )
  }

  return (
    <div className="flex w-full flex-col items-start gap-1.5">
      <span className="text-foreground text-[12px] font-normal">
        {t('pages.lawyerWorkplace.senderHistory.label', 'Address history')}
      </span>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button type="button" className="w-full outline-none">
            {trigger}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
        >
          {items.map((item) => {
            const when = item.received_at ?? item.sent_at
            return (
              <DropdownMenuItem
                key={item.id}
                disabled={item.is_current}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-[12.5px]',
                  item.is_current
                    ? 'bg-secondary-50 cursor-default'
                    : 'focus:bg-muted cursor-pointer'
                )}
                onSelect={() => {
                  if (!item.is_current) {
                    onOpenLetter?.(item.id)
                  }
                }}
              >
                <span className="flex w-full items-center justify-between gap-2">
                  <span className="text-muted-foreground text-[11px]">
                    {when ? formatLetterTime(when, t, i18n.language) : '—'}
                  </span>
                  {item.is_current && (
                    <span className="text-secondary-800 flex items-center gap-1 text-[10px] font-medium">
                      <Icons.Tick02 size={12} strokeWidth={2} />
                      {t('pages.lawyerWorkplace.senderHistory.current', 'current')}
                    </span>
                  )}
                </span>
                <span className="text-foreground w-full truncate">
                  {item.subject?.trim() ||
                    t('pages.lawyerWorkplace.senderHistory.noSubject', '(no subject)')}
                </span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
