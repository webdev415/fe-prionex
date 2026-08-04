/**
 * How a change to an assistant artifact takes effect — gw-restart /
 * hot-reload / reseed. The value comes from the brain's own deploy
 * semantics via the overview payload; the FE never infers it.
 *
 * Shared by the read-only internals card and the management cards, so an
 * admin sees the same tag for the same artifact in both places.
 */
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { AssistantApplyMode } from '../api/assistantOverviewService'

const APPLY_TONE: Record<AssistantApplyMode, string> = {
  'gw-restart': 'bg-error-100 text-error-700',
  'hot-reload': 'bg-success-100 text-success-700',
  reseed: 'bg-warning-100 text-warning-700',
}

export function ApplyBadge({ apply }: { apply: AssistantApplyMode }) {
  const { t } = useTranslation('common')

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        APPLY_TONE[apply]
      )}
    >
      {t(`pages.aiSettings.internals.apply.${apply}`)}
    </span>
  )
}

export default ApplyBadge
