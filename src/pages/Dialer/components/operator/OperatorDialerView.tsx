import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import {
  useDialerQueues,
  useDialerSocket,
  useJoinQueue,
  useLeaveQueue,
  useMyDialerSession,
} from '@/features/dialer'
import { OperatorPhonePanel } from '@/features/operatorPhone'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { ActiveCallPanel } from './ActiveCallPanel'
import { CampaignList } from './CampaignList'
import { IncomingCallPrompt } from './IncomingCallPrompt'
import { OperatorDialerSkeleton } from './OperatorDialerSkeleton'
import { ToggleChip } from './ToggleChip'

export function OperatorDialerView() {
  const { t } = useTranslation('common')

  const { data: campaigns, isLoading } = useDialerQueues()
  const { data: session } = useMyDialerSession()
  const joinMutation = useJoinQueue()
  const leaveMutation = useLeaveQueue()

  const joinedQueueId = session?.queue_id ?? null
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [autoConnect, setAutoConnect] = useState(false)
  const [acceptedCallId, setAcceptedCallId] = useState<string | null>(null)

  const { routedCall, queueComplete, clearRoutedCall } = useDialerSocket(joinedQueueId != null)

  const activeId = selectedId ?? joinedQueueId
  const activeCampaign = useMemo(
    () => campaigns?.find((c) => c.id === activeId) ?? null,
    [campaigns, activeId]
  )
  const isJoinedHere = activeCampaign != null && activeCampaign.id === joinedQueueId

  const isCallActive = routedCall != null && (autoConnect || acceptedCallId === routedCall.call_id)

  const queueCompleteNotified = useRef(false)
  useEffect(() => {
    if (queueComplete && !queueCompleteNotified.current) {
      queueCompleteNotified.current = true
      toast.info(t('dialer.operator.queueCompleted', 'The queue has been fully dialed through.'))
    }
    if (!queueComplete) queueCompleteNotified.current = false
  }, [queueComplete, t])

  const handleJoin = async () => {
    if (!activeCampaign) return
    try {
      await joinMutation.mutateAsync({ queueId: activeCampaign.id, autoConnect })
      toast.success(t('dialer.operator.joinedToast', 'Joined the dialer'))
    } catch {
      void 0
    }
  }

  const handleLeave = async () => {
    try {
      await leaveMutation.mutateAsync()
      setAcceptedCallId(null)
      toast.success(t('dialer.operator.leftToast', 'Left the dialer'))
    } catch {
      void 0
    }
  }

  const handleHangup = () => {
    setAcceptedCallId(null)
    clearRoutedCall()
  }

  // `session.status` is the operator's *global* dialer connection — it only
  // describes the campaign they're actually joined to. Showing it verbatim
  // next to whichever campaign happens to be selected would misleadingly
  // label an unjoined campaign "Active" just because the operator is
  // connected elsewhere, so it only applies when this is that campaign.
  const displayStatus = isJoinedHere ? session?.status : 'not_connected'
  const statusLabel = (() => {
    switch (displayStatus) {
      case 'active':
        return t('dialer.operator.statusActive', 'Active')
      case 'paused':
        return t('dialer.operator.statusPaused', 'Paused')
      default:
        return t('dialer.operator.statusNotConnected', 'Not connected')
    }
  })()

  const showIncoming = isJoinedHere && routedCall != null && !queueComplete && !isCallActive
  const showActiveCall = isJoinedHere && routedCall != null && !queueComplete && isCallActive

  return (
    <>
      {/* Hidden WebRTC phone (background tab) + its Offline/Connecting/Ready
          pill — always mounted so the phone session persists regardless of
          which campaign is selected (KAN-353). */}
      <div className="mb-4 flex items-center justify-end">
        <OperatorPhonePanel />
      </div>

      <div className="dialer-operator-view grid grid-cols-1 gap-4 lg:grid-cols-[minmax(280px,420px)_1fr]">
        {isLoading ? (
          <OperatorDialerSkeleton />
        ) : (
          <>
            <CampaignList
              campaigns={campaigns ?? []}
              selectedId={activeId}
              joinedId={joinedQueueId}
              onSelect={setSelectedId}
            />

            {/* Persistent translucent panel — always rendered regardless of
              selection/queue/call state, so the right section never falls back
              to a flat/opaque or fully invisible background. */}
            <section className="bg-card/60 flex h-full flex-col rounded-xl p-4 sm:p-6">
              {!activeCampaign ? (
                <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
                  <Icons.Calling02 size={40} className="text-muted-foreground" strokeWidth={1.5} />
                  <h3 className="text-foreground mt-4 text-lg font-medium sm:text-xl">
                    {t('dialer.operator.selectCampaignTitle', 'Select a campaign')}
                  </h3>
                  <p className="text-muted-foreground mt-1 max-w-xs text-sm">
                    {t(
                      'dialer.operator.selectCampaignHint',
                      'Select a campaign from the list on the left to start the dialer.'
                    )}
                  </p>
                </div>
              ) : showIncoming ? (
                <IncomingCallPrompt
                  routedCall={routedCall!}
                  campaignName={activeCampaign.name}
                  autoConnect={autoConnect}
                  onToggleAutoConnect={setAutoConnect}
                  onAccept={() => setAcceptedCallId(routedCall!.call_id)}
                  onLeave={handleLeave}
                  leaving={leaveMutation.isPending}
                />
              ) : showActiveCall ? (
                <ActiveCallPanel
                  key={routedCall!.call_id}
                  routedCall={routedCall!}
                  campaignName={activeCampaign.name}
                  waitTimeSeconds={activeCampaign.wait_time_seconds ?? 8}
                  autoConnect={autoConnect}
                  onToggleAutoConnect={setAutoConnect}
                  onLeave={handleLeave}
                  leaving={leaveMutation.isPending}
                  onHangup={handleHangup}
                />
              ) : (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-muted-foreground text-sm">{statusLabel}</span>
                      <span className="bg-muted text-foreground inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-sm font-medium">
                        <span
                          className={cn(
                            'h-1.5 w-1.5 shrink-0 rounded-full',
                            displayStatus === 'active'
                              ? 'bg-success-500'
                              : displayStatus === 'paused'
                                ? 'bg-warning-500'
                                : 'bg-muted-foreground/50'
                          )}
                        />
                        <span className="truncate">{activeCampaign.name}</span>
                      </span>
                    </div>
                    {isJoinedHere ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <ToggleChip
                          active={autoConnect}
                          onClick={() => setAutoConnect(!autoConnect)}
                        >
                          {t('dialer.call.autoConnection', 'Auto-connection')}
                        </ToggleChip>
                        <Button
                          variant="secondary"
                          size="sm"
                          leftIcon={<Icons.LoginSquare01 size={16} />}
                          onClick={handleLeave}
                          isLoading={leaveMutation.isPending}
                        >
                          {t('dialer.operator.leaveDialer', 'Leave Dialer')}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="primary"
                        leftIcon={<Icons.Phone size={18} />}
                        onClick={handleJoin}
                        isLoading={joinMutation.isPending}
                        disabled={joinedQueueId != null && joinedQueueId !== activeCampaign.id}
                      >
                        {t('dialer.operator.joinDialer', 'Join Dialer')}
                      </Button>
                    )}
                  </div>

                  <div className="text-muted-foreground mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <p className="flex items-center gap-1 text-xs">
                        <Icons.RightToLeftListNumber size={12} strokeWidth={1.8} />
                        {t('dialer.operator.inQueue', 'In queue')}
                      </p>
                      <p className="text-foreground text-base font-semibold">
                        {(activeCampaign.total_in_queue ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs">
                        <Icons.UserMultiple02 size={12} strokeWidth={1.8} />
                        {t('dialer.operator.operators', 'Operators')}
                      </p>
                      <p className="text-foreground text-base font-semibold">
                        {activeCampaign.operators_connected ?? 0}
                      </p>
                    </div>
                    <div>
                      <p className="flex items-center gap-1 text-xs">
                        <Icons.Flash size={12} strokeWidth={1.8} />
                        {t('dialer.operator.aggressiveness', 'Aggressiveness')}
                      </p>
                      <p className="text-foreground text-base font-semibold">
                        {activeCampaign.aggressiveness}×
                      </p>
                    </div>
                    {activeCampaign.calling_hours_start && activeCampaign.calling_hours_end && (
                      <div>
                        <p className="flex items-center gap-1 text-xs">
                          <Icons.Clock01 size={12} strokeWidth={1.8} />
                          {t('dialer.operator.hours', 'Hours')}
                        </p>
                        <p className="text-foreground text-base font-semibold">
                          {activeCampaign.calling_hours_start}–{activeCampaign.calling_hours_end}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="mt-6 flex flex-1 flex-col items-center justify-center py-8 text-center">
                    <Icons.Calling02
                      size={40}
                      className="text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <p className="text-muted-foreground mt-3 max-w-xs text-sm">
                      {isJoinedHere
                        ? t(
                            'dialer.operator.waitingForCall',
                            'Connected — waiting for the next call…'
                          )
                        : t(
                            'dialer.operator.joinToStart',
                            'Join the dialer to start receiving calls.'
                          )}
                    </p>
                  </div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </>
  )
}

export default OperatorDialerView
