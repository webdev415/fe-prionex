import { useTranslation } from 'react-i18next'

/**
 * Refetch overlay for the Action Analysis tables (KAN-1027/KAN-1029 UX
 * follow-up). The list hooks keep previous data on a filter change
 * (`placeholderData: keepPreviousData`), so without an explicit indicator the
 * table silently keeps showing the PREVIOUS manager's rows while the new
 * request is in flight — a trainer picks a manager and reads someone else's
 * data. This overlay dims the kept rows and shows a spinner until the refetch
 * settles. Render it inside a `relative` wrapper around the table.
 */
export function AnalyticsTableOverlay({ visible }: { visible: boolean }) {
  const { t } = useTranslation('common')
  if (!visible) return null
  return (
    <div
      data-testid="analytics-table-overlay"
      role="status"
      className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/60"
    >
      <div className="flex items-center gap-2 rounded-full border border-[#EBECE8] bg-white px-3 py-1.5 shadow-[0px_1px_2px_rgba(0,0,0,0.08)]">
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#204E4D] border-t-transparent"
        />
        <span className="text-[11px] font-medium text-[#05040D]">
          {t('pages.training.actionAnalysis.updating', 'Updating data…')}
        </span>
      </div>
    </div>
  )
}

export default AnalyticsTableOverlay
