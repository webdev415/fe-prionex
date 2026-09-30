/**
 * Tooltips of the planner section (planner story 5.1, review bot round 1).
 *
 * One `TooltipProvider` serves the whole section: `PlannerLayout` mounts
 * `PlannerTooltipProvider` once, so the pills and priority icons of a board of
 * 200 cards share one open delay (moving from pill to pill does not wait
 * again) instead of mounting a provider each. A piece drawn outside the section
 * (a test, a future embed) brings its own provider rather than crash: Radix
 * throws for a `Tooltip` without one.
 *
 * The avatar's tooltip is the CRM `PiiTooltip` (masked for session recording);
 * it keeps the provider it mounts itself.
 */
import { createContext, useContext, type ReactElement, type ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'

const TOOLTIP_DELAY_MS = 200

const InPlannerSection = createContext(false)

export function PlannerTooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>
      <InPlannerSection.Provider value={true}>{children}</InPlannerSection.Provider>
    </TooltipProvider>
  )
}

interface PlannerTooltipProps {
  /** What the tooltip says; the trigger must forward props and a ref (`asChild`). */
  label: ReactNode
  children: ReactElement
  contentClassName?: string
}

export function PlannerTooltip({ label, children, contentClassName }: PlannerTooltipProps) {
  const inSection = useContext(InPlannerSection)
  const tooltip = (
    <Tooltip delayDuration={TOOLTIP_DELAY_MS}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className={contentClassName}>{label}</TooltipContent>
    </Tooltip>
  )
  if (inSection) return tooltip
  return <TooltipProvider delayDuration={TOOLTIP_DELAY_MS}>{tooltip}</TooltipProvider>
}
