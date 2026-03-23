/**
 * MinimizedCallBubble Component
 *
 * Shows a bubble icon in the search bar area when a call modal is minimized.
 * Displays call information on hover and restores the modal on click.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCallStore } from '@/stores/callStore'
import { Icons } from '@/lib/icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { CallDialogModal } from '@/pages/ClientManagement/components/CallDialogModal'
import { CallRecordingModal } from '@/pages/ClientManagement/components/CallRecordingModal'

export function MinimizedCallBubble() {
  const { t } = useTranslation('common')
  const { minimizedCall, clearMinimizedCall, setOpenCallModal } = useCallStore()
  const [isRestored, setIsRestored] = useState(false)

  if (!minimizedCall) {
    return null
  }

  const isActiveCall =
    minimizedCall.type === 'call-dialog' &&
    (minimizedCall.callState === 'dialing' || minimizedCall.callState === 'connected')

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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  const getStatusColor = () => {
    if (minimizedCall.type === 'call-dialog') {
      if (minimizedCall.callState === 'connected') return 'bg-success-500'
      if (minimizedCall.callState === 'dialing') return 'bg-primary-500'
      if (minimizedCall.callState === 'ended') return 'bg-gray-500'
    }
    return 'bg-primary-500'
  }

  const getStatusText = () => {
    if (minimizedCall.type === 'call-dialog') {
      if (minimizedCall.callState === 'dialing') return t('pages.clients.modals.callDialog.calling')
      if (minimizedCall.callState === 'connected')
        return t('pages.clients.modals.callDialog.connected')
      if (minimizedCall.callState === 'ended') return t('pages.clients.modals.callDialog.callEnded')
      return t('pages.clients.modals.callDialog.callClient')
    }
    return t('pages.clients.modals.callRecording.title')
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
              <div className="text-xs text-gray-300">{minimizedCall.phoneNumber}</div>
            </div>
          </div>

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${getStatusColor()}`} />
            <span className="text-xs font-medium text-white">{getStatusText()}</span>
          </div>

          {/* Call details */}
          <div className="flex flex-col gap-2 border-t border-gray-700 pt-2">
            {minimizedCall.callType && (
              <div className="flex items-center gap-2">
                <Icons.Phone size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300 capitalize">
                  {minimizedCall.callType.replace('-', ' ')}
                </span>
              </div>
            )}
            {minimizedCall.elapsedTime !== undefined && minimizedCall.elapsedTime > 0 && (
              <div className="flex items-center gap-2">
                <Icons.StopWatch size={14} className="text-gray-400" strokeWidth={1.5} />
                <span className="text-xs text-gray-300">
                  {t('pages.clients.modals.callDialog.talkTime')}:{' '}
                  {formatTime(minimizedCall.elapsedTime)}
                </span>
              </div>
            )}
          </div>
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

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
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
              {/* Active call indicator dot */}
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

      {/* Restore modals */}
      {isRestored && minimizedCall.type === 'call-dialog' && (
        <CallDialogModal
          open={isRestored}
          onClose={handleClose}
          onMinimize={handleMinimize}
          clientName={minimizedCall.clientName}
          phoneNumber={minimizedCall.phoneNumber}
          callId={minimizedCall.callId}
          initialState={minimizedCall.callState || 'initial'}
          initialElapsedTime={minimizedCall.elapsedTime ?? 0}
          minimizedAt={isActiveCall ? minimizedCall.timestamp : undefined}
          initialCallType={minimizedCall.callType || 'white-line'}
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
