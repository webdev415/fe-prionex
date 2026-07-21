/**
 * Operator campaign list (KAN-379, design: operator-01).
 *
 * The left column of the operator surface: the campaigns available to the
 * operator's department, each card showing live counts. The joined campaign is
 * highlighted; clicking a card selects it.
 */

import { useTranslation } from 'react-i18next'

import type { DialerQueue } from '@/features/dialer'
import { cn } from '@/lib/utils'

interface CampaignListProps {
  campaigns: DialerQueue[]
  selectedId: number | null
  joinedId: number | null
  onSelect: (id: number) => void
}

function statusDotClass(status: DialerQueue['status']): string {
  switch (status) {
    case 'active':
      return 'bg-success-500'
    case 'paused':
      return 'bg-amber-500'
    default:
      return 'bg-muted-foreground/40'
  }
}

export function CampaignList({ campaigns, selectedId, joinedId, onSelect }: CampaignListProps) {
  const { t } = useTranslation('common')

  return (
    <aside className="border-border rounded-xl border bg-white p-4">
      <div className="mb-3">
        <h2 className="text-foreground text-sm font-semibold">
          {t('dialer.operator.myCampaigns', 'My Campaigns')}
        </h2>
        <p className="text-muted-foreground mt-1 text-xs">
          {t('dialer.operator.availableCampaigns', 'Available campaigns for your department')}
        </p>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-muted-foreground py-6 text-sm">
          {t('dialer.operator.noCampaigns', 'No campaigns available yet.')}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {campaigns.map((c) => {
            const isSelected = c.id === selectedId
            const isJoined = c.id === joinedId
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    'w-full rounded-lg border p-3 text-left transition-colors',
                    isSelected
                      ? 'border-primary-500 bg-primary-50/50'
                      : 'border-border hover:border-primary-300'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground truncate text-sm font-medium">{c.name}</span>
                    <span className="flex items-center gap-1.5">
                      {isJoined && (
                        <span className="bg-success-50 text-success-600 rounded-full px-1.5 py-0.5 text-[10px] font-medium">
                          {t('dialer.operator.joined', 'Joined')}
                        </span>
                      )}
                      <span className={cn('h-1.5 w-1.5 rounded-full', statusDotClass(c.status))} />
                    </span>
                  </div>
                  <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <span>
                      {t('dialer.operator.inQueue', 'In queue')}:{' '}
                      {(c.total_in_queue ?? 0).toLocaleString()}
                    </span>
                    <span>
                      {t('dialer.operator.operators', 'Operators')}: {c.operators_connected ?? 0}
                    </span>
                    <span>
                      {t('dialer.operator.aggressiveness', 'Aggressiveness')}: {c.aggressiveness}×
                    </span>
                    {c.calling_hours_start && c.calling_hours_end && (
                      <span>
                        {t('dialer.operator.hours', 'Hours')}: {c.calling_hours_start}–
                        {c.calling_hours_end}
                      </span>
                    )}
                  </div>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </aside>
  )
}

export default CampaignList
