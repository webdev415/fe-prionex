/**
 * Operator dialer surface (KAN-379).
 *
 * Two columns: the operator's available campaigns (their department only) and
 * the active-call workspace. This slice renders the empty state
 * (design: operator-01-empty-state); campaign data + routed-call panel land in
 * later slices (see KAN-379-aggressive-dialer-frontend-plan.md §4 Operator).
 */

import { useTranslation } from 'react-i18next'

import { Icons } from '@/lib/icons'

export function OperatorDialerView() {
  const { t } = useTranslation('common')

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      {/* Campaign list (left) */}
      <aside className="border-border rounded-xl border bg-white p-4">
        <h2 className="text-foreground text-sm font-semibold">
          {t('dialer.operator.myCampaigns', 'My Campaigns')}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('dialer.operator.availableCampaigns', 'Available campaigns for your department')}
        </p>
        <div className="text-muted-foreground mt-6 text-sm">
          {t('dialer.operator.noCampaigns', 'No campaigns available yet.')}
        </div>
      </aside>

      {/* Active-call workspace (right) — empty state */}
      <section className="border-border flex min-h-[420px] items-center justify-center rounded-xl border bg-white">
        <div className="flex flex-col items-center text-center">
          <Icons.Phone size={40} className="text-muted-foreground/60" strokeWidth={1.5} />
          <h3 className="text-foreground mt-4 text-xl font-medium">
            {t('dialer.operator.selectCampaignTitle', 'Select a campaign')}
          </h3>
          <p className="text-muted-foreground mt-1 max-w-xs text-sm">
            {t(
              'dialer.operator.selectCampaignHint',
              'Select a campaign from the list on the left to start the dialer.'
            )}
          </p>
        </div>
      </section>
    </div>
  )
}

export default OperatorDialerView
