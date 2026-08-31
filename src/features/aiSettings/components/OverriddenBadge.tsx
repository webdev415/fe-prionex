/**
 * Whether an artifact is an admin override or the brain's shipped default.
 *
 * Only rendered for an override — the default state is the norm and a badge
 * on every untouched artifact would be noise. Absent `overridden` (a brain
 * older than prionex-assistant#107) renders nothing rather than guessing.
 */
import { useTranslation } from 'react-i18next'

export function OverriddenBadge({ overridden }: { overridden?: boolean }) {
  const { t } = useTranslation('common')

  if (!overridden) return null

  return (
    <span className="bg-primary-100 text-primary-700 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium">
      {t('pages.aiSettings.management.overridden')}
    </span>
  )
}

export default OverriddenBadge
