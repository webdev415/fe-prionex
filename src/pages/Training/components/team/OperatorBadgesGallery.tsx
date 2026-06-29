import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useOperatorBadges } from '@/features/training/hooks/useLeaderboard'
import type { OperatorBadge } from '@/features/training/types/leaderboard'

/**
 * Badges gallery — mounted in `OperatorDetailPanel.badgesSlot` so it
 * appears on both the Inbox-side and Team-side panels (KAN-411
 * Feature 3.2). Renders awarded badges newest-first; clicking a badge
 * does nothing in v1 (KAN-412 owns the per-badge audit history view).
 */
export interface OperatorBadgesGalleryProps {
  operatorId: number
}

export function OperatorBadgesGallery({ operatorId }: OperatorBadgesGalleryProps) {
  const { t } = useTranslation('common')
  const { data: badges = [], isLoading } = useOperatorBadges(operatorId)

  if (isLoading) {
    return (
      <div>
        <h3 className="mb-3 text-sm font-medium tracking-[-0.02em] text-[#05040D]">
          {t('pages.training.team.badges.title', 'Badges')}
        </h3>
        <div className="text-[11px] text-[#676767]">
          {t('pages.training.team.badges.loading', 'Loading badges…')}
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium tracking-[-0.02em] text-[#05040D]">
          {t('pages.training.team.badges.title', 'Badges')}
        </h3>
        <span className="text-[11px] text-[#676767]">{badges.length}</span>
      </div>
      {badges.length === 0 ? (
        <p className="text-[11px] text-[#676767]">
          {t(
            'pages.training.team.badges.empty',
            'No badges earned yet. They unlock automatically from leaderboard ranking, scorecard streaks, and on-time tasks.'
          )}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {badges.map((badge) => (
            <BadgeChip key={badge.id} badge={badge} />
          ))}
        </div>
      )}
    </div>
  )
}

function BadgeChip({ badge }: { badge: OperatorBadge }) {
  const { t } = useTranslation('common')
  const awarded = new Date(badge.awarded_at)
  const awardedLabel = Number.isNaN(awarded.getTime()) ? '' : awarded.toLocaleDateString()
  return (
    <div
      title={`${badge.name}${badge.description ? ` — ${badge.description}` : ''}\n${awardedLabel}`}
      className="flex items-center gap-2 rounded-full border border-[#EBECE8] bg-white px-2.5 py-1 text-[11px] text-[#05040D]"
    >
      <BadgeIcon code={badge.code} icon={badge.icon} />
      <span className="font-medium">
        {t(`pages.training.team.badges.codes.${badge.code}`, badge.name)}
      </span>
    </div>
  )
}

function BadgeIcon({ code, icon }: { code: string; icon: string | null }) {
  // We only ship a small icon palette here; unknown icons fall back to
  // a generic check-badge so a new auto-rule never breaks the chip.
  const key = (icon || code || '').toLowerCase()
  if (key.includes('trophy') || key.includes('medal') || key.includes('top'))
    return <Icons.StarFilled size={14} className="text-amber-500" />
  if (key.includes('shield')) return <Icons.Shield size={14} className="text-emerald-600" />
  if (key.includes('star') || key.includes('perfect'))
    return <Icons.StarFilled size={14} className="text-amber-500" />
  if (key.includes('check') || key.includes('calendar'))
    return <Icons.CheckmarkBadge02 size={14} className="text-emerald-600" />
  return <Icons.CheckmarkBadge02 size={14} className="text-[#204E4D]" />
}
