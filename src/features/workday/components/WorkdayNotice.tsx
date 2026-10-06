/**
 * A one-line notice above a workday table (day still running, calls
 * unavailable, the cumulative calls window, the holiday calendar missing).
 *
 * Neutral card colours plus an icon: the theme tokens used here are defined in
 * every theme (`error-500` is red in all of them), unlike the `Alert`
 * variants' `*-950`/`*-300` pairs, which flip between light and dark themes.
 */
import type { ReactNode } from 'react'
import { Icons } from '@/lib/icons'

export interface WorkdayNoticeProps {
  children: ReactNode
  testId: string
  /** A degraded answer (data missing) rather than plain context. */
  warning?: boolean
}

export function WorkdayNotice({ children, testId, warning = false }: WorkdayNoticeProps) {
  return (
    <p
      data-testid={testId}
      className="border-border bg-card text-foreground flex items-start gap-2 rounded-lg border px-3 py-2 text-xs"
    >
      {warning ? (
        <Icons.Warning size={16} className="text-error-500 shrink-0" />
      ) : (
        <Icons.Info size={16} className="text-muted-foreground shrink-0" />
      )}
      <span>{children}</span>
    </p>
  )
}
