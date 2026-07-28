import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { VendorFilePhase } from '@/features/imports'

interface VendorPhaseProgressProps {
  phases: VendorFilePhase[]
  errorMessage?: string
}

function PhaseStatusBadge({ status }: { status: VendorFilePhase['status'] }) {
  const { t } = useTranslation('common')

  const base =
    'inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium text-primary-foreground'

  if (status === 'completed') {
    return (
      <span className={`${base} bg-secondary-800`}>
        <Icons.Checkmark size={12} className="text-primary-foreground" />
        {t('pages.imports.details.statuses.completed', 'Completed')}
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className={`${base} bg-secondary-800`}>
        <span className="bg-primary-foreground h-2 w-2 animate-pulse rounded-full" />
        {t('pages.imports.details.statuses.inProgress', 'In progress')}
      </span>
    )
  }
  if (status === 'failed') {
    return (
      <span className={`${base} bg-error-600`}>
        <Icons.Warning size={12} className="text-primary-foreground" />
        {t('pages.imports.details.statuses.failed', 'Failed')}
      </span>
    )
  }
  return (
    <span className="bg-muted text-muted-foreground inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium">
      <span className="bg-muted-foreground h-2 w-2 rounded-full" />
      {t('pages.imports.details.statuses.pending', 'Pending')}
    </span>
  )
}

export function VendorPhaseProgress({ phases, errorMessage }: VendorPhaseProgressProps) {
  const { t } = useTranslation('common')

  return (
    <div className="border-border bg-card/50 flex flex-1 flex-col gap-3 rounded-xl border p-4 shadow-sm sm:p-6">
      <h2 className="text-foreground text-lg leading-[150%] font-light tracking-[-0.4px] sm:text-xl">
        {t('pages.imports.details.vendor.filesProgress', 'Files & downstream progress')}
      </h2>
      <div className="bg-border h-px w-full" />

      <div className="divide-border flex flex-col divide-y">
        {phases.map((phase) => {
          const showCounters =
            phase.status === 'in_progress' &&
            typeof phase.processed === 'number' &&
            typeof phase.total === 'number'
          return (
            <div
              key={phase.logical_name}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex flex-col">
                <span className="text-foreground text-sm font-medium tracking-[-0.32px]">
                  {phase.display_name}
                </span>
                <span className="text-muted-foreground text-xs break-all">
                  {phase.filename || '—'}
                </span>
                <span className="text-muted-foreground text-xs">→ {phase.target_db}</span>
              </div>
              <div className="flex items-center gap-3">
                {showCounters && (
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {phase.processed?.toLocaleString()} / {phase.total?.toLocaleString()}
                  </span>
                )}
                <PhaseStatusBadge status={phase.status} />
              </div>
            </div>
          )
        })}
      </div>

      {errorMessage && (
        <>
          <div className="bg-border my-2 h-px w-full" />
          <div className="bg-error-50 border-error-200 text-error-700 rounded-lg border px-3 py-2 text-xs break-words">
            <div className="font-medium">
              {t('pages.imports.details.vendor.lastError', 'Last error')}
            </div>
            <div className="mt-1">{errorMessage}</div>
          </div>
        </>
      )}
    </div>
  )
}
