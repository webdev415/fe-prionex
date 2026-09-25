/**
 * Loading skeleton for Scoring v3 shadow-run report — mirrors stat tiles +
 * chart/table panels so the layout does not jump when data arrives.
 */

import { useTranslation } from 'react-i18next'

function Pulse({ className }: { className?: string }) {
  return <div className={`bg-muted rounded ${className ?? ''}`} />
}

function StatTileSkeleton() {
  return (
    <div className="border-border bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4">
      <Pulse className="h-3 w-28" />
      <Pulse className="h-8 w-20" />
      <Pulse className="h-3 w-36 max-w-full" />
    </div>
  )
}

function PanelSkeleton({
  chartClassName,
  tableRows = 5,
  withBanner = false,
}: {
  chartClassName?: string
  tableRows?: number
  withBanner?: boolean
}) {
  return (
    <section className="border-border bg-card flex w-full min-w-0 flex-col gap-3 rounded-xl border p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <Pulse className="h-5 w-48 max-w-full sm:w-64" />
        <Pulse className="h-3 w-full max-w-xl" />
      </div>
      {withBanner && <Pulse className="h-12 w-full rounded-lg" />}
      {chartClassName && <Pulse className={`w-full rounded-lg ${chartClassName}`} />}
      <div className="flex flex-col gap-0">
        <div className="border-border flex gap-3 border-b py-2">
          <Pulse className="h-3 w-16" />
          <Pulse className="h-3 w-24" />
          <Pulse className="ml-auto h-3 w-12" />
          <Pulse className="h-3 w-12" />
        </div>
        {Array.from({ length: tableRows }).map((_, i) => (
          <div
            key={i}
            className="border-border flex items-center gap-3 border-b py-3 last:border-b-0"
          >
            <Pulse className="h-4 w-14" />
            <Pulse className="h-4 w-28 max-w-[40%]" />
            <Pulse className="ml-auto h-4 w-12" />
            <Pulse className="h-4 w-10" />
          </div>
        ))}
      </div>
    </section>
  )
}

export function ScoringV3MonitoringPageSkeleton() {
  const { t } = useTranslation('common')
  return (
    <div
      className="flex w-full min-w-0 animate-pulse flex-col gap-4"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">{t('pages.scoringV3.monitoring.loading')}</span>

      <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
        <StatTileSkeleton />
      </div>

      <PanelSkeleton chartClassName="h-[260px]" tableRows={5} />
      <PanelSkeleton chartClassName="h-[280px]" tableRows={4} withBanner />
      <PanelSkeleton tableRows={4} />
      <PanelSkeleton tableRows={3} />
    </div>
  )
}

export default ScoringV3MonitoringPageSkeleton
