import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { formatDateTime } from '@/lib/formatters'
import { platformLabel } from '../lib/pairing'
import type { AppLoginDevice } from '../types'

interface AppLoginDeviceListProps {
  devices: AppLoginDevice[]
  /** Omit for a read-only list (the admin view revokes all at once). */
  onUnbind?: (device: AppLoginDevice) => void
  unbindingId?: string | null
}

export function AppLoginDeviceList({ devices, onUnbind, unbindingId }: AppLoginDeviceListProps) {
  const { t } = useTranslation('auth')

  if (devices.length === 0) {
    return <p className="text-muted-foreground text-xs sm:text-sm">{t('appLogin.devices.empty')}</p>
  }

  return (
    <ul className="flex flex-col gap-2" aria-label={t('appLogin.devices.title')}>
      {devices.map((device) => (
        <li
          key={device.id}
          data-testid="app-login-device"
          className="border-border bg-card flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Icons.Phone size={20} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
            <div className="flex min-w-0 flex-col">
              <span className="text-foreground truncate text-sm font-medium">
                {device.label || t('appLogin.devices.unnamed')}
                <span className="text-muted-foreground font-normal">
                  {' · '}
                  {platformLabel(device.platform)}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">
                {t('appLogin.devices.boundAt', {
                  date: formatDateTime(device.created_at ?? undefined),
                })}
                {' · '}
                {device.last_used_at
                  ? t('appLogin.devices.lastUsed', { date: formatDateTime(device.last_used_at) })
                  : t('appLogin.devices.neverUsed')}
              </span>
            </div>
          </div>
          {onUnbind && (
            <Button
              type="button"
              variant="cancel"
              onClick={() => onUnbind(device)}
              disabled={unbindingId === device.id}
              isLoading={unbindingId === device.id}
              className="h-9 shrink-0 rounded-md px-3 text-sm"
            >
              {t('appLogin.devices.unbind')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  )
}

export default AppLoginDeviceList
