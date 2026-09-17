import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

interface CallingWindowTooltipProps {
  /** The refusal reason, or null when calling is allowed. */
  message: string | null
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
 * Renders children untouched when calling is allowed, so the common path adds
 * no wrapper and no provider.
 */
export function CallingWindowTooltip({ message, children }: CallingWindowTooltipProps) {
  if (!message) return <>{children}</>

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="inline-block w-full xl:w-auto">{children}</span>
        </TooltipTrigger>
        <TooltipContent>{message}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
