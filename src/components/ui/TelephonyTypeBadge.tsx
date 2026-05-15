import { useTranslation } from 'react-i18next'
import type { TelephonyType } from '@/features/actionAnalysis'

interface Props {
  type?: TelephonyType | string | null
  /** Inbound calls render as an em-dash regardless of stored type
   * (KAN-476 defense-in-depth — telephony type is outbound-only). */
  direction?: string | null
}

/**
 * White / Grey telephony-type badge. Shared between the Action Analysis
 * Calls List (KAN-476) and the contact card Call/SMS section (KAN-482).
 * Inlining the same 3-branch render in both sites was the start of drift,
 * so this component centralises the i18n keys and the inbound guard.
 */
export function TelephonyTypeBadge({ type, direction }: Props) {
  const { t } = useTranslation('common')

  if (direction === 'inbound') {
    return <span className="text-sm text-gray-400">—</span>
  }
  if (type === 'white') {
    return (
      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
        {t('pages.actionAnalysis.telephonyType.white', 'White')}
      </span>
    )
  }
  if (type === 'grey') {
    return (
      <span className="bg-warning-50 text-warning-700 inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
        {t('pages.actionAnalysis.telephonyType.grey', 'Grey')}
      </span>
    )
  }
  return <span className="text-sm text-gray-400">—</span>
}
