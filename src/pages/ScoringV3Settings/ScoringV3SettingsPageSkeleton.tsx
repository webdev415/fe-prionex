/**
 * Loading skeleton for Scoring v3 settings — mirrors header, queue picker,
 * rule sections, and TTL table so the layout does not jump when data arrives.
 */

import { useTranslation } from 'react-i18next'

function Pulse({ className }: { className?: string }) {
  return <div className={`bg-muted rounded ${className ?? ''}`} />
}

function QueueRowSkeleton() {
  return (
    <div className="border-border flex min-w-[40rem] items-center gap-4 rounded-lg border px-4 py-3">
      <Pulse className="h-4 w-4 shrink-0 rounded-full" />
      <Pulse className="h-4 w-28" />
      <Pulse className="ml-auto h-4 w-16" />
      <Pulse className="h-4 w-14" />
      <Pulse className="h-4 w-12" />
    </div>
  )
}

function FieldRowSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Pulse className="h-4 w-48 max-w-full" />
        <Pulse className="h-3 w-full max-w-md" />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Pulse className="h-10 w-24 rounded-lg" />
        <Pulse className="h-3 w-16" />
      </div>
    </div>
  )
}

function SectionSkeleton({ fields = 3 }: { fields?: number }) {
  return (
    <section className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6">
      <Pulse className="h-5 w-56 max-w-full" />
      <Pulse className="mt-2 mb-5 h-3 w-full max-w-xl" />
      <div className="divide-border flex flex-col divide-y">
        {Array.from({ length: fields }).map((_, i) => (
          <FieldRowSkeleton key={i} />
        ))}
      </div>
    </section>
  )
}

export function ScoringV3SettingsPageSkeleton() {
  const { t } = useTranslation('common')
  return (
    <div
      className="flex w-full min-w-0 animate-pulse flex-col gap-6 pb-28"
      aria-busy="true"
      aria-live="polite"
      role="status"
    >
      <span className="sr-only">{t('pages.scoringV3.settings.loading')}</span>

      <header className="flex flex-col gap-2">
        <Pulse className="h-7 w-64 max-w-full sm:h-8 sm:w-80" />
        <Pulse className="h-4 w-full max-w-3xl" />
        <Pulse className="h-4 w-full max-w-2xl" />
      </header>

      <section className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6">
        <Pulse className="h-5 w-72 max-w-full" />
        <Pulse className="mt-2 mb-5 h-3 w-full max-w-3xl" />
        <div className="w-full min-w-0 overflow-x-auto">
          <div className="flex min-w-[40rem] flex-col gap-2">
            <div className="flex items-center gap-4 px-4">
              <span className="w-4" />
              <Pulse className="h-3 w-20" />
              <Pulse className="ml-auto h-3 w-20" />
              <Pulse className="h-3 w-20" />
              <Pulse className="h-3 w-20" />
            </div>
            <QueueRowSkeleton />
            <QueueRowSkeleton />
            <QueueRowSkeleton />
          </div>
        </div>
        <Pulse className="mt-4 h-3 w-40" />
      </section>

      <SectionSkeleton fields={4} />
      <SectionSkeleton fields={2} />
      <SectionSkeleton fields={3} />

      <section className="border-border bg-card w-full min-w-0 rounded-xl border p-4 sm:p-6">
        <Pulse className="h-5 w-64 max-w-full" />
        <Pulse className="mt-2 mb-5 h-3 w-full max-w-3xl" />
        <div className="border-border overflow-hidden rounded-lg border">
          <div className="bg-muted flex gap-3 px-3 py-2">
            <Pulse className="h-3 w-24" />
            <Pulse className="h-3 w-28" />
            <Pulse className="ml-auto h-3 w-16" />
            <Pulse className="h-3 w-16" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border-border flex items-center gap-3 border-t px-3 py-2.5">
              <Pulse className="h-4 w-28" />
              <Pulse className="h-4 w-12" />
              <Pulse className="ml-auto h-4 w-14" />
              <Pulse className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

export default ScoringV3SettingsPageSkeleton
