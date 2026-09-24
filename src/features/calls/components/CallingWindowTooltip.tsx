import type { KeyboardEvent, ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface CallingWindowTooltipProps {
  /** The refusal reason, or null when calling is allowed. */
  message: string | null
  /**
   * Called when the operator presses the disabled button. Shows the reason
   * and records the blocked attempt — see useCallingWindow's reportBlocked.
   */
  onBlockedAttempt?: () => void
  /**
   * Width classes for the wrapper, which must mirror the button it wraps —
   * the three call sites use three different contracts, and a wrapper that
   * disagrees resizes the button between the allowed and blocked states.
   */
  className?: string
  children: ReactNode
}

/**
 * Explains why a call button is disabled by the calling window (KAN-1107).
 *
 * A plain `title` on the button does not work: Button carries
 * `disabled:pointer-events-none`, so a disabled button never receives hover
 * and the native tooltip never appears — the operator is left with a dead
 * control and no reason. The span wrapper stays interactive and gives the
 * tooltip something to hang off, which is the same fix DocumentTypesTab uses
 * for its disabled delete button.
 *
 * The same property is what makes the press reportable: the click passes
 * through the disabled button and lands here, as do Enter and Space once the
 * wrapper has focus — a disabled button is skipped by keyboard navigation, so
 * the wrapper takes the tab stop.
 *
 * Renders children untouched when calling is allowed, so the common path adds
 * no wrapper and no provider.
 */
export function CallingWindowTooltip({
  message,
  onBlockedAttempt,
  className = 'w-full',
  children,
}: CallingWindowTooltipProps) {
  if (!message) return <>{children}</>

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      // Space would otherwise scroll the page, as it does for any non-button.
      event.preventDefault()
      onBlockedAttempt?.()
    }
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          {/* Deliberately no role. Giving the wrapper role="button" put a
              second button named after the first around it, so assistive
              technology announced the control twice. The one it should
              announce is the real, disabled button inside; the wrapper only
              carries the tab stop and the press. */}
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
          <span
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            data-calling-window-blocked=""
            onClick={onBlockedAttempt}
            onKeyDown={onKeyDown}
            className={`inline-block ${className}`}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
