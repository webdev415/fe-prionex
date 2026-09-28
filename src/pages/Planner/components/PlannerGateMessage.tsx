/**
 * What a direct address of the planner section shows instead of the section
 * (planner story 1.9, AC3 and AC4). Rendered in place — no redirect — like
 * every other `PermissionRoute` fallback in the CRM.
 *
 * Imported directly by the router (not through the `@/pages/Planner` barrel),
 * so the lazy chunk of the section is not pulled in for someone who cannot open it.
 */
import { useTranslation } from 'react-i18next'
import { Alert } from '@/components/ui/Alert'

export type PlannerGateKind = 'no-access' | 'unavailable' | 'loading'

export function PlannerGateMessage({ kind }: { kind: PlannerGateKind }) {
  const { t } = useTranslation('planner')

  if (kind === 'loading') {
    return (
      <div className="p-6" aria-busy="true">
        <div className="bg-muted mb-4 h-7 w-48 rounded" />
        <p className="text-muted-foreground text-sm">{t('gate.loading')}</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <h1 className="text-foreground mb-4 text-xl font-semibold">{t('section.title')}</h1>
      <div className="border-border bg-card rounded-xl border p-6 shadow-sm">
        <Alert variant={kind === 'no-access' ? 'error' : 'warning'}>
          {kind === 'no-access' ? t('gate.noAccess') : t('gate.unavailable')}
        </Alert>
      </div>
    </div>
  )
}

export default PlannerGateMessage
