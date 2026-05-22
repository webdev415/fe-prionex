/**
 * MinimizedCallBubble
 *
 * Renders the minimized call state in the top navigation bar.
 *
 * Two render modes (mounted in DashboardLayout's two header slots):
 *   • lg+   — inline bar with status, phone, timer, line-type badge,
 *             hang-up button, and expand button (visible at all times).
 *   • <lg   — compact 40×40 bubble with hover tooltip (mobile fallback;
 *             top bar has no width budget for the inline bar).
 *
 * Both render paths share the same store-driven state, the same live-tick
 * timer, the same backend state polling, and the same auto-dismiss timer.
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useCallStore } from '@/stores/callStore'
import { useCallDetails, useHangupCall } from '@/features/calls/hooks/useCall'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { CallDialogModal } from '@/pages/ClientManagement/components/CallDialogModal'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'

export function MinimizedCallBubble() {
  const { t } = useTranslation('common')
  const { minimizedCall, setMinimizedCall, clearMinimizedCall, setOpenCallModal } = useCallStore()
  const queryClient = useQueryClient()
  const [isRestored, setIsRestored] = useState(false)
  const hangupMutation = useHangupCall()

  const isActiveCall =
    minimizedCall?.type === 'call-dialog' &&
    (minimizedCall.callState === 'dialing' || minimizedCall.callState === 'connected')

  // Poll backend call state while minimized and call is active
  const activeCallId = isActiveCall && minimizedCall?.callId ? minimizedCall.callId : null
  const { data: callDetails } = useCallDetails(activeCallId)

  // Live elapsed time: compute from the snapshot + time passed since minimized.
  // Only advance the timer for dialing/connected — otherwise 'initial' or 'ended'
  // states would accrue a fake "talk time" after a page refresh.
  const [liveElapsedTime, setLiveElapsedTime] = useState(() => {
    if (!minimizedCall) return 0
    const base = minimizedCall.elapsedTime ?? 0
    const isLive =
      minimizedCall.type === 'call-dialog' &&
      (minimizedCall.callState === 'dialing' || minimizedCall.callState === 'connected')
    if (isLive && minimizedCall.timestamp) {
      return base + Math.floor((Date.now() - minimizedCall.timestamp) / 1000)
    }
    return base
  })

  // Sync backend state into the store so the inline bar reflects transitions
  // while minimized: dialing → connected → ended. Mirrors the modal's
  // backend-state mapping so the bar and modal stay in lockstep.
  useEffect(() => {
    if (!callDetails || !minimizedCall || minimizedCall.type !== 'call-dialog') return

    let nextState: 'dialing' | 'connected' | 'ended' | 'failed' | null = null
    switch (callDetails.state) {
      case 'INITIATED':
      case 'RINGING':
        nextState = 'dialing'
        break
      case 'ACTIVE':
        nextState = 'connected'
        break
      case 'COMPLETED':
        nextState = 'ended'
        break
      case 'FAILED':
        nextState = 'failed'
        break
    }
    if (!nextState || minimizedCall.callState === nextState) return

    const isTerminal = nextState === 'ended' || nextState === 'failed'
    setMinimizedCall({
      ...minimizedCall,
      callState: nextState,
      elapsedTime: isTerminal
        ? (callDetails.total_duration ?? liveElapsedTime)
        : minimizedCall.elapsedTime,
    })
    if (isTerminal) {
      queryClient.invalidateQueries({ queryKey: ['callHistory'] })
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail'] })
    }
  }, [callDetails]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!minimizedCall || !isActiveCall) {
      return
    }
    // Tick every second
    const interval = setInterval(() => {
      if (minimizedCall.timestamp && minimizedCall.elapsedTime !== undefined) {
        setLiveElapsedTime(
          minimizedCall.elapsedTime + Math.floor((Date.now() - minimizedCall.timestamp) / 1000)
        )
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [isActiveCall, minimizedCall])

  // Auto-dismiss the bar once the call settles into a terminal state. Both
  // hang-up-from-bar and remote-party-hangup funnel through callState='ended'
  // / 'failed' via the polling effect above, so this single timer covers both.
  useEffect(() => {
    if (!minimizedCall || minimizedCall.type !== 'call-dialog') return
    const state = minimizedCall.callState
    if (state !== 'ended' && state !== 'failed') return
    const handle = setTimeout(() => {
      setOpenCallModal(null)
      clearMinimizedCall()
    }, 3000)
    return () => clearTimeout(handle)
  }, [minimizedCall, setOpenCallModal, clearMinimizedCall])

  if (!minimizedCall) {
    return null
  }

  const handleRestore = () => {
    setIsRestored(true)
  }

  const handleClose = () => {
    setIsRestored(false)
    setOpenCallModal(null)
    clearMinimizedCall()
  }

  const handleMinimize = () => {
    // When minimized from restored modal, just close the modal without clearing the state
    // The modal's handleMinimize will update the minimized state
    setIsRestored(false)
  }

  const handleHangup = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    if (!minimizedCall || minimizedCall.type !== 'call-dialog' || hangupMutation.isPending) {
      return
    }
    const callId = minimizedCall.callId
    if (!callId) {
      // No callId yet — just mark ended locally and let the auto-dismiss clear.
      setMinimizedCall({ ...minimizedCall, callState: 'ended' })
      return
    }
    hangupMutation.mutate(callId, {
      onSuccess: () => {
        const total = callDetails?.total_duration ?? minimizedCall.elapsedTime ?? liveElapsedTime
        setMinimizedCall({ ...minimizedCall, callState: 'ended', elapsedTime: total })
        queryClient.invalidateQueries({ queryKey: ['callHistory'] })
        queryClient.invalidateQueries({ queryKey: ['clients', 'detail'] })
      },
      onError: () => {
        // Match the modal: force-end on the FE regardless of AMI errors.
        setMinimizedCall({ ...minimizedCall, callState: 'ended' })
      },
    })
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const getStatusColor = () => {
    if (minimizedCall.type === 'call-dialog') {
      if (minimizedCall.callState === 'connected') return 'bg-success-500'
      if (minimizedCall.callState === 'dialing') return 'bg-primary-500'
      if (minimizedCall.callState === 'failed') return 'bg-danger-500'
      if (minimizedCall.callState === 'ended') return 'bg-gray-500'
      if (minimizedCall.callState === 'initial') return 'bg-gray-400'
    }
    return 'bg-primary-500'
  }

  const getStatusText = () => {
    if (minimizedCall.type === 'call-dialog') {
      if (minimizedCall.callState === 'dialing') return t('pages.clients.modals.callDialog.calling')
      if (minimizedCall.callState === 'connected')
        return t('pages.clients.modals.callDialog.connected')
      if (minimizedCall.callState === 'ended') return t('pages.clients.modals.callDialog.callEnded')
      if (minimizedCall.callState === 'failed')
        return t('pages.clients.modals.callDialog.callEnded')
      if (minimizedCall.callState === 'initial')
        return t('pages.clients.modals.callDialog.readyToCall')
      return t('pages.clients.modals.callDialog.callClient')
    }
    return t('pages.clients.modals.callRecording.title')
  }

  const getLineLabel = (): string | null => {
    if (minimizedCall.type !== 'call-dialog') return null
    if (minimizedCall.callType === 'gray-line') return t('pages.clients.modals.callDialog.lineGray')
    if (minimizedCall.callType === 'white-line')
      return t('pages.clients.modals.callDialog.lineWhite')
    return null
  }

  const getTooltipContent = () => {
    if (minimizedCall.type === 'call-dialog') {
      return (
        <div className="flex min-w-[280px] flex-col gap-3">
          {/* Header with icon and title */}
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getStatusColor()}`}
            >
              <Icons.Headset size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate text-sm font-semibold text-white">
                {minimizedCall.clientName}
              </div>
              <div className="text-xs text-gray-300">
                {minimizedCall.displayPhone || minimizedCall.phoneNumber}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
            <span className="text-xs font-medium text-white">{getStatusText()}</span>
          </div>

          {/* Call details — hidden in 'initial' state since the user hasn't confirmed a call type or started dialing */}
          {minimizedCall.callState !== 'initial' && (
            <div className="flex flex-col gap-2 border-t border-gray-700 pt-2">
              {minimizedCall.callType && (
                <div className="flex items-center gap-2">
                  <Icons.Phone size={14} className="text-gray-400" strokeWidth={1.5} />
                  <span className="text-xs text-gray-300 capitalize">
                    {minimizedCall.callType.replace('-', ' ')}
                  </span>
                </div>
              )}
              {liveElapsedTime > 0 && (
                <div className="flex items-center gap-2">
                  <Icons.StopWatch size={14} className="text-gray-400" strokeWidth={1.5} />
                  <span className="text-xs text-gray-300">
                    {t('pages.clients.modals.callDialog.talkTime')}: {formatTime(liveElapsedTime)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )
    } else {
      // call-recording
      return (
        <div className="flex min-w-[280px] flex-col gap-3">
          {/* Header with icon and title */}
          <div className="flex items-center gap-3">
            <div className="bg-primary-500 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              <Icons.Voice size={20} className="text-white" strokeWidth={1.5} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="truncate text-sm font-semibold text-white">
                {minimizedCall.callData?.clientName || minimizedCall.clientName}
              </div>
              <div className="text-xs text-gray-300">
                {minimizedCall.callData?.phone || minimizedCall.phoneNumber}
              </div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className="bg-primary-500 h-2 w-2 rounded-full" />
            <span className="text-xs font-medium text-white">
              {t('pages.clients.modals.callRecording.title')}
            </span>
          </div>

          {/* Call details */}
          <div className="flex flex-col gap-2 border-t border-gray-700 pt-2">
            {minimizedCall.callData?.type && (
              <div className="flex items-center gap-2">
                <Icons.Info size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">{minimizedCall.callData.type}</span>
              </div>
            )}
            {minimizedCall.callData?.operator && (
              <div className="flex items-center gap-2">
                <Icons.User size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {t('pages.clients.modals.callRecording.operator')}:{' '}
                  {minimizedCall.callData.operator}
                </span>
              </div>
            )}
            {minimizedCall.callData?.duration && (
              <div className="flex items-center gap-2">
                <Icons.StopWatch size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {t('pages.clients.modals.callRecording.duration')}:{' '}
                  {minimizedCall.callData.duration}
                </span>
              </div>
            )}
            {minimizedCall.callData?.date && minimizedCall.callData?.time && (
              <div className="flex items-center gap-2">
                <Icons.Calendar size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {minimizedCall.callData.date} {minimizedCall.callData.time}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
  }

  const isCallDialog = minimizedCall.type === 'call-dialog'
  const lineLabel = getLineLabel()
  const phoneDisplay = isCallDialog
    ? minimizedCall.displayPhone || minimizedCall.phoneNumber
    : minimizedCall.callData?.phone || minimizedCall.phoneNumber

  // Inline bar — desktop / lg+. Rendered hidden on smaller viewports so the
  // bubble (below) takes over.
  const inlineBar = isCallDialog ? (
    <div
      className={cn(
        'animate-in fade-in-0 slide-in-from-top-1 bg-secondary-800 hidden h-10 items-center gap-2 rounded-md pr-1 pl-3 text-white shadow-sm lg:flex'
      )}
      role="group"
      aria-label="Active call"
    >
      <span className={cn('h-2 w-2 shrink-0 rounded-full', getStatusColor())} />
      <span className="text-xs font-medium whitespace-nowrap">{getStatusText()}</span>
      <span className="text-xs whitespace-nowrap text-gray-300 tabular-nums">{phoneDisplay}</span>
      {(minimizedCall.callState === 'dialing' ||
        minimizedCall.callState === 'connected' ||
        minimizedCall.callState === 'ended') && (
        <span className="flex items-center gap-1 text-xs text-gray-300 tabular-nums">
          <Icons.StopWatch size={12} strokeWidth={1.5} />
          {formatTime(liveElapsedTime)}
        </span>
      )}
      {lineLabel && (
        <span
          className={cn(
            'rounded-sm px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
            minimizedCall.callType === 'gray-line'
              ? 'bg-gray-600 text-gray-100'
              : 'bg-gray-100 text-gray-800'
          )}
        >
          {lineLabel}
        </span>
      )}
      {isActiveCall && (
        <button
          type="button"
          onClick={handleHangup}
          disabled={hangupMutation.isPending}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all duration-150',
            'bg-danger-500 hover:bg-danger-400 text-white hover:scale-110',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100'
          )}
          aria-label={t('pages.clients.modals.callDialog.hangUp')}
          title={t('pages.clients.modals.callDialog.hangUp')}
        >
          <Icons.CallEnd size={16} strokeWidth={2} />
        </button>
      )}
      <button
        type="button"
        onClick={handleRestore}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-white/10"
        aria-label="Expand call"
        title="Expand"
      >
        <Icons.HeadsetConnected size={16} strokeWidth={1.5} />
      </button>
    </div>
  ) : (
    // call-recording: keep the bubble look-and-feel at lg+ too — there are no
    // controls to expose inline (no live timer, no hang-up, no line-type).
    <div className="hidden lg:flex">
      <button
        type="button"
        onClick={handleRestore}
        className="bg-secondary-800 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md transition-all duration-200 hover:scale-105 hover:opacity-90"
        aria-label="Restore call recording"
      >
        <Icons.Voice size={20} className="text-white" strokeWidth={1.5} />
      </button>
    </div>
  )

  // Compact bubble + hover tooltip — preserved for narrow viewports (<lg).
  const bubble = (
    <div className="flex lg:hidden">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleRestore}
              className={`bg-secondary-800 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md transition-all duration-200 duration-500 hover:scale-105 hover:opacity-90 ${
                isActiveCall ? 'animate-pulse' : 'animate-[pulse_3s_ease-in-out_infinite]'
              }`}
              aria-label="Restore call modal"
            >
              <Icons.HeadsetConnected
                size={20}
                className={`text-white transition-transform duration-300 ${
                  isActiveCall ? 'animate-pulse' : ''
                }`}
                strokeWidth={1.5}
              />
              {isActiveCall && (
                <>
                  <span className="bg-success-500 border-secondary-800 absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-ping rounded-full border-2" />
                  <span className="bg-success-500 border-secondary-800 absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" />
                </>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            sideOffset={8}
            className="max-w-sm border border-gray-700 bg-gray-900 p-4 shadow-xl"
          >
            {getTooltipContent()}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )

  return (
    <>
      {inlineBar}
      {bubble}

      {/* Restore modals */}
      {isRestored && minimizedCall.type === 'call-dialog' && (
        <CallDialogModal
          open={isRestored}
          onClose={handleClose}
          onMinimize={handleMinimize}
          clientId={minimizedCall.clientId}
          clientName={minimizedCall.clientName}
          phoneNumber={minimizedCall.phoneNumber}
          callId={minimizedCall.callId}
          initialState={minimizedCall.callState || 'initial'}
          initialElapsedTime={minimizedCall.elapsedTime ?? 0}
          minimizedAt={isActiveCall ? minimizedCall.timestamp : undefined}
          initialCallType={minimizedCall.callType || 'white-line'}
          initialManualPhoneEnabled={minimizedCall.manualPhoneEnabled ?? false}
          initialManualPhoneDigits={minimizedCall.manualPhoneDigits ?? ''}
        />
      )}

      {isRestored && minimizedCall.type === 'call-recording' && minimizedCall.callData && (
        <CallRecordingModal
          open={isRestored}
          onClose={handleClose}
          onMinimize={handleMinimize}
          callData={minimizedCall.callData}
        />
      )}
    </>
  )
}
