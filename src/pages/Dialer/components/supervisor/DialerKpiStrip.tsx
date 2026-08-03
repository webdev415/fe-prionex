/**
 * DialerKpiStrip (KAN-379, design: supervisor-04 / supervisor-07).
 *
 * Shared KPI surface used by the Queue-of-Numbers and Analysis tabs: one
 * translucent card container with a themed border, each cell showing an icon in a
 * 40x40 circle badge + label + value on one line, and cells separated by
 * an inset hairline (full-width on mobile, a short centred vertical rule on sm+).
 */

import { Fragment, type ReactNode } from 'react'

export interface DialerKpiItem {
  icon: ReactNode
  label: string
  /** Pre-formatted value (string or number). */
  value: ReactNode
}

export function DialerKpiStrip({ items }: { items: DialerKpiItem[] }) {
  return (
    <div className="border-border bg-card/50 flex flex-col rounded-xl border sm:flex-row sm:items-stretch">
      {items.map((item, i) => (
        <Fragment key={item.label}>
          {i > 0 && (
            <span
              aria-hidden
              className="bg-border h-px w-full shrink-0 self-center sm:h-10 sm:w-px"
            />
          )}
          <div className="flex flex-1 items-center gap-3 px-4 py-3">
            <div className="bg-card text-secondary-800 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
              {item.icon}
            </div>
            <span className="text-foreground truncate text-xs">{item.label}</span>
            <span className="text-foreground ml-auto text-sm font-semibold">{item.value}</span>
          </div>
        </Fragment>
      ))}
    </div>
  )
}

export default DialerKpiStrip
