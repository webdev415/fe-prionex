/**
 * MinimizedChainExecutorBubble Component
 *
 * Shows a bubble icon in the header when a chain executor modal is minimized.
 * Displays chain info on hover and restores the modal on click.
 * Follows the same pattern as MinimizedCallBubble.
 */

import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useChainExecutorStore } from '@/stores/chainExecutorStore'
import { Icons } from '@/lib/icons'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { Modal, ModalContent } from '@/components/ui/Modal'
import { ChainExecutor } from '@/pages/ClientManagement/components/taChains/ChainExecutor'

export function MinimizedChainExecutorBubble() {
  const { t } = useTranslation('common')
  const { minimized, clear } = useChainExecutorStore()
  const [isRestored, setIsRestored] = useState(false)
  const minimizeRef = useRef<(() => void) | null>(null)
  // Keep a cached copy of the last known minimized info so the restored
  // modal survives the store being cleared (ChainExecutor clears on mount).
  // We update state during render (before any early return), which is the
  // React-recommended pattern for storing information from previous renders.
  const [cachedInfo, setCachedInfo] = useState(minimized)
  if (minimized && minimized !== cachedInfo) setCachedInfo(minimized)

  if (!minimized && !isRestored) return null

  const info = minimized ?? cachedInfo!

  const handleRestore = () => setIsRestored(true)

  const handleClose = () => {
    setIsRestored(false)
    clear()
  }

  const handleMinimize = () => {
    setIsRestored(false)
  }

  return (
    <>
      {!isRestored && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleRestore}
                className="bg-secondary-800 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 relative flex h-10 w-10 shrink-0 animate-[pulse_3s_ease-in-out_infinite] cursor-pointer items-center justify-center rounded-md transition-all duration-200 duration-500 hover:scale-105 hover:opacity-90"
                aria-label={t('pages.clientChains.restoreChainExecutor', {
                  defaultValue: 'Restore chain executor',
                })}
              >
                <Icons.PlayCircle02 size={20} className="text-white" strokeWidth={1.5} />
                <span className="bg-primary-500 border-secondary-800 absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              sideOffset={8}
              className="max-w-sm border border-gray-700 bg-gray-900 p-4 shadow-xl"
            >
              <div className="flex min-w-[240px] flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary-500 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
                    <Icons.PlayCircle02 size={20} className="text-white" strokeWidth={1.5} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="truncate text-sm font-semibold text-white">
                      {info.clientName}
                    </div>
                    <div className="text-xs text-gray-300">
                      {info.chainName ??
                        t('pages.clientChains.chainExecution', { defaultValue: 'Chain execution' })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-gray-700 pt-2">
                  <Icons.Info size={14} className="text-gray-400" strokeWidth={1.5} />
                  <span className="text-xs text-gray-300">
                    {t('pages.clientChains.stepProgress', {
                      current: info.currentStepOrder,
                      total: info.totalSteps,
                      defaultValue: `Step ${info.currentStepOrder} of ${info.totalSteps}`,
                    })}
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {isRestored && (
        <Modal open={isRestored} onClose={handleClose} maxWidth="xl" showCloseButton={false}>
          {/* Minimize & Close buttons */}
          <div className="absolute top-2 right-2 flex items-center gap-1 sm:top-4 sm:right-12">
            <button
              onClick={() => minimizeRef.current?.()}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              aria-label="Minimize modal"
            >
              <Icons.Remove02 size={20} className="text-dark-500" strokeWidth={1.5} />
            </button>
            <button
              onClick={handleClose}
              className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-gray-100"
              aria-label="Close modal"
            >
              <Icons.Cancel01 size={20} className="text-dark-500" strokeWidth={1.5} />
            </button>
          </div>
          <ModalContent>
            <ChainExecutor
              clientId={info.clientId}
              clientName={info.clientName}
              debts={info.debts}
              onSave={handleClose}
              onMinimize={handleMinimize}
              onMinimizeRef={minimizeRef}
            />
          </ModalContent>
        </Modal>
      )}
    </>
  )
}
