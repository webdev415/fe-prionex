import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface CallingWindowTooltipProps {
  /** The refusal reason, or null when calling is allowed. */
  message: string | null
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
 * The span takes a tab stop of its own: a disabled button is skipped by
 * keyboard navigation, so without one the reason is reachable by pointer
 * only — the same dead control this component exists to prevent, for a
 * different input method.
 *
 * Renders children untouched when calling is allowed, so the common path adds
 * no wrapper and no provider.
 */
export function CallingWindowTooltip({
  message,
  className = 'w-full',
  children,
}: CallingWindowTooltipProps) {
  if (!message) return <>{children}</>

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          {/* The wrapper needs a tab stop of its own because the button it
              wraps is disabled and therefore skipped by keyboard navigation —
              the usual answer (put the label on the control) cannot reach it.
              A real <button> is the house pattern elsewhere but would nest a
              button inside a button here. */}
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
          <span tabIndex={0} className={`inline-block ${className}`}>
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
