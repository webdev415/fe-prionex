import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import type { RoutedCall } from '@/features/dialer'
import { Icons } from '@/lib/icons'

import { ToggleChip } from './ToggleChip'

interface IncomingCallPromptProps {
  routedCall: RoutedCall
  campaignName: string
  autoConnect: boolean
  onToggleAutoConnect: (value: boolean) => void
  onAccept: () => void
  /** The Accept is sent and the phone has not confirmed yet. */
  accepting?: boolean
  onLeave: () => void
  leaving?: boolean
}

export function IncomingCallPrompt({
  routedCall,
  campaignName,
  autoConnect,
  onToggleAutoConnect,
  onAccept,
  accepting = false,
  onLeave,
  leaving,
}: IncomingCallPromptProps) {
  const { t } = useTranslation('common')

  const lineLabel =
    routedCall.line_type === 'white'
      ? t('dialer.call.white', 'WHITE')
      : t('dialer.call.grey', 'GREY')

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-foreground flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
          <span className="shrink-0">{t('dialer.call.incomingCall', 'Incoming Call')}</span>
          <span className="bg-muted inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-medium">
            <span className="bg-warning-500 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full" />
            <span className="truncate">{campaignName}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleChip active={autoConnect} onClick={() => onToggleAutoConnect(!autoConnect)}>
            {t('dialer.call.autoConnection', 'Auto-connection')}
          </ToggleChip>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icons.LoginSquare01 size={16} />}
            onClick={onLeave}
            isLoading={leaving}
          >
            {t('dialer.operator.leaveDialer', 'Leave Dialer')}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          <div className="bg-primary/15 text-foreground flex h-16 w-16 items-center justify-center rounded-full">
            <Icons.Phone size={30} strokeWidth={1.5} />
          </div>
          <p className="text-foreground text-lg font-semibold">
            {routedCall.client_name || t('dialer.call.unknownClient', 'Unknown contact')}
          </p>
          <p className="text-muted-foreground text-sm">{routedCall.phone}</p>
          <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs font-semibold">
            {lineLabel}
          </span>
        </div>
        <Button
          variant="primary"
          size="lg"
          leftIcon={<Icons.Phone size={18} />}
          onClick={onAccept}
          disabled={accepting}
          isLoading={accepting}
        >
          {t('dialer.call.acceptCall', 'Accept call')}
        </Button>
      </div>
    </section>
  )
}

export default IncomingCallPrompt
