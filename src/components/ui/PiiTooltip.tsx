/**
 * A hover-reveal that OpenReplay can mask (KAN-KB-54).
 *
 * 🔴 THE PROBLEM IT SOLVES. Outside `privateMode` the tracker does not mask
 * attributes at all: `sendNodeAttribute` sends `title`, `aria-label` and
 * `alt` exactly as written, from an obscured node and from a hidden one alike.
 * So `<button title={clientFullName}>#{clientId}</button>` puts the client's
 * name into every recording, and no amount of markup around it helps.
 *
 * 🔴 WHY NOT JUST DELETE THE `title`. Because in this codebase the pattern is
 * not a duplicated label — it is a hover-reveal. The button SHOWS `#1024` and
 * the tooltip says who that is; the operator hovers precisely to find out. The
 * rules "drop the duplicate" and "replace it with a role" both destroy the
 * feature rather than fixing the leak.
 *
 * Radix renders tooltip content as a TEXT NODE in a portal, and text nodes are
 * exactly what `data-openreplay-obscured` masks. So the hover keeps working for
 * the operator and arrives as asterisks in the replay.
 *
 * ⚠️ `TooltipProvider` is mounted HERE, per instance, because that is how this
 * codebase does it (`components/ui/SearchResults.tsx`) — there is no global
 * provider in `App.tsx` or `main.tsx`, and introducing one from a markup change
 * would be a far wider blast radius than the leak being closed.
 */

import type { ReactElement } from 'react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './Tooltip'
import { Pii } from '@/lib/openreplay/pii'

export interface PiiTooltipProps {
  /** The personal data to reveal on hover. Nothing renders when it is absent. */
  label?: string | null
  /** The visible element. Must forward props and a ref — Radix uses `asChild`. */
  children: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Matches the delay already used elsewhere in this codebase. */
  delayDuration?: number
}

export function PiiTooltip({
  label,
  children,
  side = 'top',
  delayDuration = 200,
}: PiiTooltipProps) {
  // No label, no tooltip: the element is returned untouched rather than wrapped
  // in an empty one, which would give the operator a blank black box on hover.
  if (!label) return children

  return (
    <TooltipProvider>
      <Tooltip delayDuration={delayDuration}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side}>
          <Pii>{label}</Pii>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export default PiiTooltip
