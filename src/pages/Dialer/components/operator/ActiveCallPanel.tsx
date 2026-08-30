import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import type { RoutedCall } from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { ChainExecutor } from '@/pages/ClientManagement/components/taChains/ChainExecutor'

import { CallInteractionForm } from './CallInteractionForm'
import { ClientInfoPopup } from './ClientInfoPopup'
import { ToggleChip } from './ToggleChip'

interface ActiveCallPanelProps {
  routedCall: RoutedCall
  campaignName: string
  waitTimeSeconds: number
  autoConnect: boolean
  /**
   * Hides the per-operator toggle. On an accept_mode 'auto' queue the gateway
   * bridges the customer regardless, so offering it would promise control the
   * operator does not have.
   */
  hideAutoConnect?: boolean
  onToggleAutoConnect: (value: boolean) => void
  onLeave: () => void
  leaving?: boolean
  /** Wrap-up is over (or was skipped): release the operator for the next call. */
  onHangup: () => void
  /**
   * The operator pressed Hang up. Distinct from onHangup, which fires only once
   * wrap-up finishes — the leg has to drop when the button is pressed, not
   * after the operator's post-call admin time, or the customer sits on an open
   * line for the whole countdown.
   */
  onEndCall?: () => void
}

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/** Stands in for a client-bound section when the call has no client record. */
function NoClientNotice({ text }: { text: string }) {
  return (
    <div className="border-border text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
      {text}
    </div>
  )
}

export function ActiveCallPanel({
  routedCall,
  campaignName,
  waitTimeSeconds,
  autoConnect,
  hideAutoConnect = false,
  onToggleAutoConnect,
  onLeave,
  leaving,
  onHangup,
  onEndCall,
}: ActiveCallPanelProps) {
  const { t } = useTranslation('common')

  const [phase, setPhase] = useState<'active' | 'wrapup'>('active')
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [wrapRemaining, setWrapRemaining] = useState(waitTimeSeconds)
  const [infoOpen, setInfoOpen] = useState(false)

  // A dial-list number can arrive with no client attached. The client-bound
  // sections are hidden rather than fed a placeholder id: an interaction saved
  // against client 0 posts to /clients/0/interactions and fails, which reads to
  // the operator as a broken Save button rather than as missing data.
  const clientId = routedCall.client_id
  const clientName = routedCall.client_name ?? ''

  useEffect(() => {
    if (phase !== 'active') return
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [phase])

  useEffect(() => {
    if (phase !== 'wrapup') return
    if (wrapRemaining <= 0) {
      onHangup()
      return
    }
    const id = setTimeout(() => setWrapRemaining((r) => r - 1), 1000)
    return () => clearTimeout(id)
  }, [phase, wrapRemaining, onHangup])

  const elapsed = Math.max(
    0,
    Math.floor((nowMs - new Date(routedCall.started_at).getTime()) / 1000)
  )

  const lineLabel =
    routedCall.line_type === 'white'
      ? t('dialer.call.white', 'WHITE')
      : t('dialer.call.grey', 'GREY')

  const isWrapup = phase === 'wrapup'

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-foreground flex min-w-0 flex-wrap items-center gap-2 text-sm font-medium">
          <span className="shrink-0">
            {isWrapup
              ? t('dialer.call.wrapUp', 'Wrap-up')
              : t('dialer.call.activeCall', 'Active Call')}
          </span>
          <span className="bg-muted inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-xs font-medium">
            <span
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                isWrapup ? 'bg-warning-500' : 'bg-success-500'
              )}
            />
            <span className="truncate">{campaignName}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!hideAutoConnect && (
            <ToggleChip active={autoConnect} onClick={() => onToggleAutoConnect(!autoConnect)}>
              {t('dialer.call.autoConnection', 'Auto-connection')}
            </ToggleChip>
          )}
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

      <div className="bg-sidebar text-sidebar-foreground flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-3 sm:px-4">
        <span className="text-sm font-medium sm:text-base">{routedCall.phone}</span>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="flex items-center gap-1.5 text-sm">
            <Icons.Clock01 size={16} />
            {isWrapup
              ? t('dialer.call.wrapUpIn', 'Wrap-up {{s}}s', { s: wrapRemaining })
              : fmtClock(elapsed)}
          </span>
          <span className="rounded bg-black/25 px-2 py-0.5 text-xs font-semibold">{lineLabel}</span>
          {isWrapup ? (
            <button
              type="button"
              onClick={onHangup}
              className="rounded-md bg-white/15 px-2 py-1 text-xs font-medium hover:bg-white/25"
            >
              {t('dialer.call.skip', 'Skip')}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onEndCall?.()
                setPhase('wrapup')
              }}
              aria-label={t('dialer.call.hangUp', 'Hang up')}
              className="bg-error-500 hover:bg-error-600 flex h-8 w-8 items-center justify-center rounded-md text-white transition-colors"
            >
              <Icons.CallEnd size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[3fr_5fr]">
        <div className="flex flex-col gap-4">
          {clientId != null ? (
            <CallInteractionForm
              clientId={clientId}
              clientName={clientName}
              phone={routedCall.phone}
            />
          ) : (
            <NoClientNotice
              text={t(
                'dialer.call.noClientInteraction',
                'This number was dialed without client details, so an interaction cannot be logged against a client record.'
              )}
            />
          )}
        </div>

        <div className="border-border border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-foreground text-sm font-semibold">
              {t('dialer.call.taChain', 'TA Chain')}
            </p>
            {clientId != null && (
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-medium transition-colors"
              >
                <Icons.User02 size={14} />
                {t('dialer.call.viewClient', 'View Client')}
                <Icons.ArrowRight02 size={16} />
              </button>
            )}
          </div>
          {clientId != null ? (
            <ChainExecutor
              clientId={clientId}
              clientName={clientName}
              contactSource="client"
              prefilledPhone={routedCall.phone}
            />
          ) : (
            <NoClientNotice
              text={t(
                'dialer.call.noClientChain',
                'A TA chain needs a client record. None is attached to this number.'
              )}
            />
          )}
        </div>
      </div>

      {clientId != null && (
        <ClientInfoPopup
          open={infoOpen}
          onClose={() => setInfoOpen(false)}
          clientId={clientId}
          clientName={clientName}
          phone={routedCall.phone}
        />
      )}
    </section>
  )
}

export default ActiveCallPanel
