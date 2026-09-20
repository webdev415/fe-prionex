/**
 * Dialer hub page (KAN-379 — Aggressive Dialer).
 *
 * Single entry for both personas. The surface is chosen by permission:
 *   - SUPERVISE → supervisor admin (queues, number upload, statistics, restart)
 *   - otherwise (OPERATE) → operator campaign queue + routed-call workspace
 *
 * The route is gated on DIALER.VIEW; this component picks the inner view.
 */

import { useTranslation } from 'react-i18next'

import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks/usePermissions'

import { CallingWindowBanner } from './components/CallingWindowBanner'
import { OperatorDialerView } from './components/operator/OperatorDialerView'
import { SupervisorDialerView } from './components/supervisor/SupervisorDialerView'

export function DialerPage() {
  const { t } = useTranslation('common')
  const isSupervisor = useHasPermission(PERMISSIONS.DIALER.SUPERVISE)

  return (
    <div className="flex w-full flex-col">
      <header className="mb-4">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t('dialer.title', 'Dialer')}
        </h1>
      </header>

      <CallingWindowBanner />

      {isSupervisor ? <SupervisorDialerView /> : <OperatorDialerView />}
    </div>
  )
}

export default DialerPage
