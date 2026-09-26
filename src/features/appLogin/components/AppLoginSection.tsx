import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useMyAppLoginStatus, useRevokeMyAppLoginDevice } from '../hooks/useAppLogin'
import {
  DEFAULT_MAX_DEVICES,
  activeDevices,
  appLoginErrorMessage,
  findNewDevice,
  isFeatureAvailable,
  platformLabel,
} from '../lib/pairing'
import type { AppLoginDevice, AppLoginPairing } from '../types'
import { AppLoginEnableModal } from './AppLoginEnableModal'
import { AppLoginDisableModal } from './AppLoginDisableModal'
import { AppLoginPairingPanel } from './AppLoginPairingPanel'
import { AppLoginDeviceList } from './AppLoginDeviceList'

/** How often the profile asks whether the phone has enrolled yet. */
export const PAIRING_POLL_MS = 3000

interface ActivePairing {
  pairing: AppLoginPairing
  issuedAt: number
  /** Devices that were already bound when this code was issued. */
  baselineIds: ReadonlySet<string>
}

interface AppLoginSectionProps {
  className?: string
}

/**
 * «Вхід через мобільний застосунок» — bind the phone in the CRM profile
 * (Epic 19 §6.0, board #1532). A bound phone signs in to Prionex Hub from any
 * network; the section is invisible while the feature flag is off (the API
 * answers 404 or `feature_available=false`).
 */
export function AppLoginSection({ className }: AppLoginSectionProps) {
  const { t } = useTranslation('auth')
  const [active, setActive] = useState<ActivePairing | null>(null)
  const [justPaired, setJustPaired] = useState<AppLoginDevice | null>(null)
  const [enableOpen, setEnableOpen] = useState(false)
  const [disableOpen, setDisableOpen] = useState(false)
  const [unbindTarget, setUnbindTarget] = useState<AppLoginDevice | null>(null)

  const {
    data: status,
    isLoading,
    isError,
  } = useMyAppLoginStatus({
    pollMs: active ? PAIRING_POLL_MS : false,
    // One extra tick past the TTL: a phone that enrolled in the last seconds
    // still lands as «connected» instead of «expired».
    pollUntil: active
      ? active.issuedAt + active.pairing.expires_in * 1000 + PAIRING_POLL_MS
      : undefined,
  })
  const revoke = useRevokeMyAppLoginDevice()

  const devices = activeDevices(status)
  const maxDevices = status?.max_devices ?? DEFAULT_MAX_DEVICES
  // «On» means a phone can actually use it. The API keeps `enabled=true` after
  // the owner unbinds the LAST phone one by one (only disable/revoke-all clear
  // it); showing «Enabled» with no phone and «Bind another phone» would lie.
  const enabled = status?.enabled !== false && devices.length > 0

  // The phone has enrolled: the poll brought a device that was not there when
  // the code was issued.
  useEffect(() => {
    if (!active) return
    const fresh = findNewDevice(active.baselineIds, status)
    if (fresh) {
      setActive(null)
      setJustPaired(fresh)
    }
  }, [active, status])

  // Hidden until the first answer, and for good when there is none (404 = flag
  // off, or auth unreachable). A failed POLL keeps the last answer on screen —
  // react-query keeps `data` — so a network blip does not wipe the pairing code.
  if (isLoading || (isError && !status) || !isFeatureAvailable(status)) return null

  const startPairing = (pairing: AppLoginPairing) => {
    setEnableOpen(false)
    setJustPaired(null)
    setActive({
      pairing,
      issuedAt: Date.now(),
      baselineIds: new Set(devices.map((device) => device.id)),
    })
  }

  const handleToggle = (next: boolean) => {
    if (next) {
      setEnableOpen(true)
      return
    }
    if (active && !enabled) {
      // Only a code was issued, nothing is bound yet: dropping the code is
      // enough, it dies on the server by its TTL.
      setActive(null)
      return
    }
    setDisableOpen(true)
  }

  const confirmUnbind = async () => {
    if (!unbindTarget) return
    try {
      await revoke.mutateAsync(unbindTarget.id)
      toast.success(t('appLogin.devices.unbound', { label: unbindTarget.label }))
      if (justPaired?.id === unbindTarget.id) setJustPaired(null)
    } catch (err: unknown) {
      toast.error(appLoginErrorMessage(err, t('appLogin.devices.unbindFailed')))
    } finally {
      setUnbindTarget(null)
    }
  }

  const canAddAnother = enabled && !active && devices.length < maxDevices
  const toggleOn = enabled || active !== null

  return (
    <div
      data-testid="app-login-section"
      className={cn(
        'border-border bg-muted flex w-full flex-col gap-4 self-stretch rounded-xl border p-5',
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="bg-primary-300 flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icons.Phone size={20} className="text-primary-foreground" strokeWidth={1.5} />
        </div>
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
            enabled ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-700'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              enabled ? 'bg-success-600' : 'bg-muted-foreground'
            )}
          />
          {enabled ? t('appLogin.section.statusEnabled') : t('appLogin.section.statusDisabled')}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-foreground text-sm leading-tight font-semibold">
          {t('appLogin.section.title')}
        </span>
        <span className="text-muted-foreground text-xs leading-snug sm:text-sm">
          {/* «From any network» only when this stand really skips the IP
              whitelist for a bound phone (a separate server flag). */}
          {status?.device_ip_bypass === true
            ? t('appLogin.section.description')
            : t('appLogin.section.descriptionNoBypass')}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="text-foreground text-sm" aria-hidden="true">
          {t('appLogin.section.toggle')}
        </span>
        <ToggleSwitch
          checked={toggleOn}
          onChange={handleToggle}
          ariaLabel={t('appLogin.section.toggle')}
        />
      </div>

      {justPaired && (
        <div
          role="status"
          className="bg-success-50 text-success-700 flex items-center gap-2 rounded-md px-3 py-2 text-sm"
        >
          <Icons.Checkmark size={18} className="shrink-0" />
          <span>
            {t('appLogin.pairing.paired', {
              label: justPaired.label || platformLabel(justPaired.platform),
            })}
          </span>
        </div>
      )}

      {active && (
        <AppLoginPairingPanel
          pairing={active.pairing}
          issuedAt={active.issuedAt}
          onRequestNew={() => setEnableOpen(true)}
          onCancel={() => setActive(null)}
        />
      )}

      {!enabled && !active && (
        <Button
          type="button"
          variant="primary"
          onClick={() => setEnableOpen(true)}
          leftIcon={<Icons.Phone size={20} />}
          className="h-11 w-full rounded-md"
        >
          {t('appLogin.section.bind')}
        </Button>
      )}

      {enabled && (
        <div className="flex flex-col gap-2">
          <span className="text-foreground text-sm font-medium">{t('appLogin.devices.title')}</span>
          <AppLoginDeviceList
            devices={devices}
            onUnbind={setUnbindTarget}
            unbindingId={revoke.isPending ? (unbindTarget?.id ?? null) : null}
          />
          {canAddAnother && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEnableOpen(true)}
              leftIcon={<Icons.Phone size={18} className="shrink-0" />}
              className="h-auto min-h-11 w-full rounded-md px-3 py-2.5 text-center leading-snug whitespace-normal"
            >
              {t('appLogin.section.bindAnother')}
            </Button>
          )}
          {!canAddAnother && !active && devices.length >= maxDevices && (
            <span className="text-muted-foreground text-xs">
              {t('appLogin.devices.limitReached', { max: maxDevices })}
            </span>
          )}
        </div>
      )}

      <AppLoginEnableModal
        open={enableOpen}
        onClose={() => setEnableOpen(false)}
        onPairingIssued={startPairing}
      />
      <AppLoginDisableModal
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        onDisabled={() => {
          setActive(null)
          setJustPaired(null)
        }}
      />
      <ConfirmDialog
        open={unbindTarget !== null}
        tone="danger"
        title={t('appLogin.devices.unbindTitle')}
        message={t('appLogin.devices.unbindMessage', { label: unbindTarget?.label ?? '' })}
        confirmLabel={t('appLogin.devices.unbind')}
        cancelLabel={t('appLogin.enable.cancel')}
        isLoading={revoke.isPending}
        onConfirm={confirmUnbind}
        onCancel={() => setUnbindTarget(null)}
      />
    </div>
  )
}

export default AppLoginSection
