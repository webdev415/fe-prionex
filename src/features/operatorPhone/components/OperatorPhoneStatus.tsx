import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import type { PhoneStatus } from '../protocol'

const DOT_CLASS: Record<PhoneStatus, string> = {
  offline: 'bg-muted-foreground/50',
  connecting: 'bg-warning-500',
  ready: 'bg-success-500',
  error: 'bg-error-500',
}

export interface OperatorPhoneStatusProps {
  status: PhoneStatus
  aor: string | null
}

/** The Offline / Connecting / Ready pill (KAN-353). All the phone UI the
 * operator sees lives in the CRM; the iframe itself is invisible. */
export function OperatorPhoneStatus({ status, aor }: OperatorPhoneStatusProps) {
  const { t } = useTranslation('common')

  const label: Record<PhoneStatus, string> = {
    offline: t('dialer.phone.offline', 'Offline'),
    connecting: t('dialer.phone.connecting', 'Connecting'),
    ready: t('dialer.phone.ready', 'Ready'),
    error: t('dialer.phone.error', 'Phone error'),
  }

  return (
    <span
      className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium"
      role="status"
      aria-live="polite"
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', DOT_CLASS[status])} />
      {label[status]}
      {aor ? <span className="text-muted-foreground">· {aor}</span> : null}
    </span>
  )
}
