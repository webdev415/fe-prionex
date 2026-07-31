/**
 * Operator campaign list (KAN-379, design: operator-01).
 *
 * The left column of the operator surface: the campaigns available to the
 * operator's department, each card showing live counts. The currently
 * selected campaign is highlighted with a primary-tinted row + left accent
 * bar; clicking a row selects it.
 */

import { useTranslation } from 'react-i18next'

import type { DialerQueue } from '@/features/dialer'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface CampaignListProps {
  campaigns: DialerQueue[]
  selectedId: number | null
  joinedId: number | null
  onSelect: (id: number) => void
}

function statusMeta(
  status: DialerQueue['status'],
  t: (key: string, fallback: string) => string
): { label: string; textClass: string; dotClass: string } {
  switch (status) {
    case 'active':
      return {
        label: t('dialer.queueStatus.active', 'Active'),
        textClass: 'text-success-600',
        dotClass: 'bg-success-500',
      }
    case 'paused':
      return {
        label: t('dialer.queueStatus.paused', 'Pause'),
        textClass: 'text-warning-600',
        dotClass: 'bg-warning-500',
      }
    case 'empty':
      return {
        label: t('dialer.queueStatus.empty', 'Queue is empty'),
        textClass: 'text-muted-foreground',
        dotClass: 'bg-muted-foreground',
      }
    default:
      return {
        label: t('dialer.queueStatus.inactive', 'Inactive'),
        textClass: 'text-muted-foreground',
        dotClass: 'bg-muted-foreground',
      }
  }
}

export function CampaignList({ campaigns, selectedId, joinedId, onSelect }: CampaignListProps) {
  const { t } = useTranslation('common')

  return (
    <aside className="border-border bg-card/60 relative flex h-full min-h-0 flex-col overflow-hidden rounded-xl border">
      <div className="bg-card relative z-10 flex shrink-0 items-start justify-between gap-2 p-3 pb-3 sm:p-4">
        <div className="min-w-0">
          <h2 className="text-foreground text-sm font-semibold">
            {t('dialer.operator.myCampaigns', 'My Campaigns')}
          </h2>
          <p className="text-muted-foreground mt-1 text-xs">
            {t('dialer.operator.availableCampaigns', 'Available campaigns for your department')}
          </p>
        </div>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium">
          {t('dialer.operator.campaignCount', '{{count}} campaigns', {
            count: campaigns.length,
          })}
        </span>
      </div>

      {campaigns.length === 0 ? (
        <div className="bg-card text-muted-foreground px-4 pb-4 text-sm">
          {t('dialer.operator.noCampaigns', 'No campaigns available yet.')}
        </div>
      ) : (
        // Desktop (lg+): absolute inset list so this column's height is driven
        // by the right panel (absolute children don't contribute intrinsic
        // height). Mobile: in-flow list with a capped max-height so the panel
        // still shows rows when stacked in a single-column grid.
        <div className="relative min-h-0 max-h-[min(55vh,480px)] flex-1 lg:max-h-none">
          {/* `bg-card` here (not just on each row) keeps any leftover space
              below the last row — when the list is shorter than the
              right-hand panel's height — looking like part of the same solid
              card instead of falling through to the aside's translucent
              backdrop. */}
          <ul className="border-border divide-border dialer-campaign-list-scroll bg-card max-h-full divide-y overflow-y-auto border-t lg:absolute lg:inset-0">
            {campaigns.map((c) => {
              const isSelected = c.id === selectedId
              const isJoined = c.id === joinedId
              const meta = statusMeta(c.status, t)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'block w-full border-l-4 px-4 py-3 text-left transition-colors',
                      isSelected
                        ? 'bg-primary/10 border-l-primary-500'
                        : 'bg-card hover:bg-muted/40 border-l-transparent'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-foreground flex min-w-0 items-center gap-1.5 truncate text-sm font-medium">
                        <span className="truncate">{c.name}</span>
                        {isJoined && (
                          <span
                            className="bg-success-500 h-1.5 w-1.5 shrink-0 rounded-full"
                            title={t('dialer.operator.joined', 'Joined')}
                          />
                        )}
                      </span>
                      <span className={cn('flex shrink-0 items-center gap-1.5 text-xs', meta.textClass)}>
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dotClass)} />
                        {meta.label}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <span className="flex items-center gap-1">
                        <Icons.RightToLeftListNumber size={12} strokeWidth={1.8} />
                        {t('dialer.operator.inQueue', 'In queue')}:{' '}
                        {(c.total_in_queue ?? 0).toLocaleString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icons.UserMultiple02 size={12} strokeWidth={1.8} />
                        {t('dialer.operator.operators', 'Operators')}: {c.operators_connected ?? 0}
                      </span>
                      <span className="flex min-w-0 items-center gap-1">
                        <Icons.Flash size={12} className="shrink-0" strokeWidth={1.8} />
                        <span className="truncate">
                          {t('dialer.operator.aggressiveness', 'Aggressiveness')}: {c.aggressiveness}×
                        </span>
                      </span>
                      {c.calling_hours_start && c.calling_hours_end && (
                        <span className="flex min-w-0 items-center gap-1">
                          <Icons.Clock01 size={12} className="shrink-0" strokeWidth={1.8} />
                          <span className="truncate">
                            {t('dialer.operator.hours', 'Hours')}: {c.calling_hours_start}–
                            {c.calling_hours_end}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </aside>
  )
}

export default CampaignList
