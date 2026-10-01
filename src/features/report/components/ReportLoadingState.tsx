/**
 * The loading state of the Reports page tabs (Tasks/Kanbanboard#100).
 *
 * WHY: a cold report request takes up to ~30 s on production (measured
 * 01.10.2026, Kanbanboard#50), and the bare pale skeleton read as an empty or
 * frozen table after a couple of seconds. Every tab now shows the same card —
 * «Завантаження даних…», plus the elapsed seconds from the 3rd second on — in
 * both of its loading phases:
 *
 * - FIRST LOAD (`query.isLoading`): {@link ReportTableLoading} keeps the
 *   table skeleton and centres the card over it;
 * - NEW WINDOW over the previous rows (`query.isPlaceholderData`):
 *   {@link ReportRefreshingOverlay} dims the stale rows as before and shows
 *   the card FIXED at the bottom of the viewport, portalled to `document.body`.
 *   A page change is clicked at the paginator below a long table, where the
 *   top of the overlay is already scrolled away; and `position: sticky` does
 *   not engage on this layout at all — DashboardLayout's `main` has
 *   `overflow-y-auto` with only `min-h-screen`, so it is the scroll container
 *   sticky measures against, yet it never scrolls (the document does; see
 *   EmployeeCardPage for the same finding). The portal also keeps `fixed`
 *   immune to any transformed ancestor.
 *
 * The Dashboard tab, which has its own page skeleton, uses
 * {@link ReportLoadingStatus} directly.
 *
 * One component for all fifteen tabs instead of fifteen copies: the copies
 * are what made the old state drift into "a spinner here, nothing there".
 * `TableSkeleton` itself is NOT changed — 78 places outside the Reports page
 * use it, and this is a reports-only decision. There is deliberately no
 * cancel button and no "this can take long" hint (decided 01.10.2026).
 *
 * Accessibility: the card is a polite live region (`role="status"`); whether
 * and when it is announced depends on the screen reader — a region that
 * mounts with its text already in place is not announced reliably by all of
 * them. The counter is `aria-hidden`, so a reader that does follow the region
 * is not made to re-announce "7 с", "8 с", "9 с" every second.
 */

import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { useElapsedSeconds } from '@/hooks/useElapsedSeconds'

/** The counter appears from this many whole seconds of waiting. */
export const ELAPSED_VISIBLE_FROM_SECONDS = 3

export interface ReportLoadingStatusProps {
  /** Extra classes for positioning. */
  className?: string
}

/**
 * The caption card itself. Mounting it starts the clock, so each loading
 * phase counts from zero: the parent mounts it when loading begins and
 * unmounts it when the data arrives.
 */
export function ReportLoadingStatus({ className }: ReportLoadingStatusProps) {
  const { t } = useTranslation()
  const elapsed = useElapsedSeconds(true)
  const showElapsed = elapsed >= ELAPSED_VISIBLE_FROM_SECONDS

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="report-loading-status"
      className={`border-border bg-card text-foreground flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium shadow-sm ${className ?? ''}`}
    >
      <span
        aria-hidden="true"
        className="border-primary-500 inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-t-transparent"
      />
      <span>{t('pages.reports.loading.caption')}</span>
      {showElapsed && (
        <span
          aria-hidden="true"
          data-testid="report-loading-elapsed"
          className="text-muted-foreground whitespace-nowrap tabular-nums"
        >
          {t('pages.reports.loading.elapsed', { seconds: elapsed })}
        </span>
      )}
    </div>
  )
}

export interface ReportTableLoadingProps {
  /** Column count of the real table, so the skeleton keeps its width. */
  columns: number
  /** Skeleton rows (default 6, what every tab used). */
  rows?: number
}

/** First load of a tab: the table skeleton with the caption card over it. */
export function ReportTableLoading({ columns, rows = 6 }: ReportTableLoadingProps) {
  return (
    <div className="relative w-full">
      <TableSkeleton columns={columns} rows={rows} />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <ReportLoadingStatus />
      </div>
    </div>
  )
}

export interface ReportRefreshingOverlayProps {
  /** The tab's existing test id, kept so the tab tests keep finding it. */
  testId: string
}

/**
 * A new window loading over the previous rows. The stale rows stay visible
 * but dimmed — they must not look final, and the dim layer still blocks
 * clicks on them and on the paginator — while the card is fixed at the bottom
 * centre of the viewport, wherever the page is scrolled (see the header for
 * why not sticky). It lives exactly as long as the overlay: both unmount when
 * the new data arrives.
 */
export function ReportRefreshingOverlay({ testId }: ReportRefreshingOverlayProps) {
  return (
    <div data-testid={testId} className="bg-card/60 absolute inset-0 z-10 rounded-xl">
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <ReportLoadingStatus />
        </div>,
        document.body
      )}
    </div>
  )
}
