import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { OperatorPhonePanel, useOperatorPhone } from '@/features/operatorPhone'
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
  // Null means "not touched this session", so the operator's stored preference
  // shows through. Derived rather than copied into state on load: a reload while
  // joined must not display "off" while the phone is still answering calls.
  const [autoConnectOverride, setAutoConnect] = useState<boolean | null>(null)
  const autoConnect = autoConnectOverride ?? session?.auto_connect ?? false
  const [acceptedCallId, setAcceptedCallId] = useState<string | null>(null)

  const {
    routedCall: socketRoutedCall,
    endedCallId: socketEndedCallId,
    queueComplete,
    clearRoutedCall: clearSocketRoutedCall,
  } = useDialerSocket(joinedQueueId != null)

  // The call belongs to the queue the operator joined, never to whichever one
  // they happen to be browsing.
  const joinedCampaign = useMemo(
    () => campaigns?.find((c) => c.id === joinedQueueId) ?? null,
    [campaigns, joinedQueueId]
  )

  // The queue's own accept_mode outranks the operator's preference: on 'auto'
  // the gateway bridges the customer with no chance to decline, so the phone
  // must be armed to answer even if the operator's own toggle is off — the
  // toggle is hidden on such a queue and could not be turned on.
  const queueAutoAnswers = joinedCampaign?.answer_mode === 'auto'

  const phoneFrameRef = useRef<HTMLIFrameElement>(null)
  const {
    status: phoneStatus,
    aor: phoneAor,
    routedCall: phoneRoutedCall,
    answeredCallId,
    endedCallId,
    answerCall,
    hangupCall,
    clearRoutedCall: clearPhoneRoutedCall,
  } = useOperatorPhone(phoneFrameRef, { autoAnswer: autoConnect || queueAutoAnswers })

  // Two drivers announce a routed call by different routes. The fake engine
  // emits `dialer.call_routed` on the CRM's own socket; the Aggressive Dialer
  // publishes it only to the phone's presence socket, which the phone relays up
  // over postMessage. Without this second source the CRM shows nothing at all
  // while the operator's handset is ringing.
  // Pinned to the call, not to the memo: any other dependency changing mid-call
  // would otherwise restart the elapsed timer the operator is reading.
  const phoneCallStartedAt = useMemo(
    () => new Date().toISOString(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phoneRoutedCall?.call_id]
  )

  const routedCall = useMemo(() => {
    if (socketRoutedCall) return socketRoutedCall
    if (!phoneRoutedCall) return null
    return {
      call_id: phoneRoutedCall.call_id,
      // Passed through as-is. A dial-list number can carry no client, and
      // substituting 0 here would make every downstream guard unreachable on
      // exactly the path where the absence occurs — an interaction saved
      // against client 0 posts to /clients/0/interactions and fails.
      client_id: phoneRoutedCall.client_id,
      client_name: phoneRoutedCall.client_name,
      phone: phoneRoutedCall.phone ?? '',
      line_type: joinedCampaign?.telephony_type ?? 'white',
      started_at: phoneCallStartedAt,
    }
  }, [socketRoutedCall, phoneRoutedCall, joinedCampaign?.telephony_type, phoneCallStartedAt])

  const clearRoutedCall = useCallback(() => {
    clearSocketRoutedCall()
    clearPhoneRoutedCall()
  }, [clearSocketRoutedCall, clearPhoneRoutedCall])

  // True when this call reached us via the phone relay rather than the CRM
  // socket. The two paths confirm differently: the phone reports when the leg
  // is actually up, the fake engine reports nothing, so only the former can be
  // shown as connected on fact rather than on assumption.
  const isPhoneRoutedCall = socketRoutedCall == null && phoneRoutedCall != null

  // The leg has dropped but the call is still on screen for wrap-up. Compared
  // by id so a late 'ended' for a superseded call cannot close the current one.
  const callEnded =
    routedCall != null &&
    (isPhoneRoutedCall ? endedCallId : socketEndedCallId) === routedCall.call_id

  const handleAccept = useCallback(() => {
    if (!routedCall) return
    // Recorded on both paths now. The socket path uses it to show the call as
    // connected; the phone path uses it only to stop a second Accept going out
    // while the first is still being confirmed — a repeat accept reaches a call
    // that is already up, which the phone cannot apply.
    if (acceptedCallId === routedCall.call_id) return
    setAcceptedCallId(routedCall.call_id)
    answerCall(routedCall.call_id)
  }, [routedCall, answerCall, acceptedCallId])

  // The phone path always waits for confirmation, whatever the queue's mode:
  // an 'auto' queue means the gateway will bridge the call, not that it already
  // has, and claiming a connected call before the leg is up shows the operator a
  // running clock over silence.
  const isCallActive =
    routedCall != null &&
    (isPhoneRoutedCall
      ? answeredCallId === routedCall.call_id
      : queueAutoAnswers || autoConnect || acceptedCallId === routedCall.call_id)

  // The Accept has gone to the phone and we are waiting for it to confirm.
  const acceptPending = routedCall != null && acceptedCallId === routedCall.call_id && !isCallActive

  // Ended before it was ever answered — an abandoned ring, which is routine on
  // an outbound dialer. There is no conversation to wrap up and no note to
  // save, so the offer is simply withdrawn rather than left as an Accept button
  // over a dead leg that nothing can dismiss.
  const callAbandoned = callEnded && !isCallActive

  // A live call pins the view to the joined campaign. With auto-answer pushed
  // down, the phone can connect the operator to a customer while the CRM is
  // rendering another campaign's stats and no call UI at all. An abandoned ring
  // must not pin it, or campaign navigation stays locked to a dead call.
  const hasCall = (socketRoutedCall != null || phoneRoutedCall != null) && !callAbandoned
  const activeId = hasCall && joinedQueueId != null ? joinedQueueId : (selectedId ?? joinedQueueId)
  const activeCampaign = useMemo(
    () => campaigns?.find((c) => c.id === activeId) ?? null,
    [campaigns, activeId]
  )
  const isJoinedHere = activeCampaign != null && activeCampaign.id === joinedQueueId

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
      // Leaving with a live leg would strand the customer on an unattended
      // line, so drop it first rather than only closing the CRM's view of it.
      // Not just an active call: a still-ringing offer left behind keeps the
      // customer waiting on a leg no one will answer.
      if (routedCall && !callEnded) hangupCall(routedCall.call_id)
      await leaveMutation.mutateAsync()
      setAcceptedCallId(null)
      // Neither call source is tied to the session, so anything left here
      // survives to the next join — and an already-answered call would come
      // back as a live call panel for a customer who hung up long ago.
      clearRoutedCall()
      toast.success(t('dialer.operator.leftToast', 'Left the dialer'))
    } catch {
      void 0
    }
  }

  // The operator pressed Hang up. Drop the leg now; wrap-up is their own admin
  // time and the customer must not be held on the line for it.
  const handleEndCall = useCallback(() => {
    if (routedCall && !callEnded) hangupCall(routedCall.call_id)
  }, [routedCall, callEnded, hangupCall])

  // Wrap-up is over (or was skipped): release the operator for the next call.
  // The leg is normally already down by now — either the customer ended it or
  // handleEndCall did — so only hang up if something is somehow still up.
  // Memoised deliberately: ActiveCallPanel's wrap-up countdown lists this in its
  // effect deps, and a fresh reference each render restarts the one-second timer.
  // Wrap-up finishing is what clears the call and promotes a queued one, so an
  // unstable reference here can stall both.
  const handleHangup = useCallback(() => {
    if (routedCall && !callEnded) hangupCall(routedCall.call_id)
    setAcceptedCallId(null)
    clearRoutedCall()
  }, [routedCall, callEnded, hangupCall, clearRoutedCall])

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

  // No Accept on an 'auto' queue: the gateway bridges the customer with no
  // chance to decline, so a prompt there offers a choice the operator does not
  // have — over audio that may already be live. The panel still waits for the
  // phone's confirmation before claiming the call is connected, so there is a
  // brief moment with neither, which is the honest state.
  const showIncoming =
    isJoinedHere &&
    routedCall != null &&
    !queueComplete &&
    !isCallActive &&
    !callAbandoned &&
    !queueAutoAnswers
  const showActiveCall = isJoinedHere && routedCall != null && !queueComplete && isCallActive

  return (
    <>
      {/* Hidden WebRTC phone (background tab) + its Offline/Connecting/Ready
          pill — always mounted so the phone session persists regardless of
          which campaign is selected (KAN-353). */}
      <div className="mb-4 flex items-center justify-end">
        <OperatorPhonePanel iframeRef={phoneFrameRef} status={phoneStatus} aor={phoneAor} />
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
                  onAccept={handleAccept}
                  accepting={acceptPending}
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
                  hideAutoConnect={queueAutoAnswers}
                  onToggleAutoConnect={setAutoConnect}
                  onLeave={handleLeave}
                  leaving={leaveMutation.isPending}
                  onHangup={handleHangup}
                  onEndCall={handleEndCall}
                  callEnded={callEnded}
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
                        {/* On an auto-accept queue the gateway bridges the
                            customer regardless, so the toggle would promise
                            control the operator does not have. */}
                        {!queueAutoAnswers && (
                          <ToggleChip
                            active={autoConnect}
                            onClick={() => setAutoConnect(!autoConnect)}
                          >
                            {t('dialer.call.autoConnection', 'Auto-connection')}
                          </ToggleChip>
                        )}
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
