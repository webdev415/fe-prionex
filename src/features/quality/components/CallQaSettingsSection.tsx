/**
 * CallQaSettingsSection — admin card with the global «AI call analysis»
 * switch (Call QA). Mirrors the IP-whitelist enforcement gate it sits next
 * to: title + one-line description on the left, ToggleSwitch on the right,
 * toasts on success/error.
 *
 * Visible only under `manage_call_qa`; the PUT is server-gated by the same
 * permission. While the switch is OFF, transcript endpoints answer
 * 403 call_qa_disabled and client-card transcript panels hide entirely.
 */
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'

import { useCallQaSettings, useUpdateCallQaSettings } from '../hooks/useCallQaSettings'

export function CallQaSettingsSection() {
  const { t } = useTranslation('common')
  const { data: settings, isLoading } = useCallQaSettings()
  const mutation = useUpdateCallQaSettings()

  const enabled = settings?.transcripts_enabled === true

  const handleToggle = async (next: boolean) => {
    try {
      await mutation.mutateAsync({ transcripts_enabled: next })
      toast.success(
        next ? t('pages.callQaSettings.toastEnabled') : t('pages.callQaSettings.toastDisabled')
      )
    } catch {
      toast.error(t('pages.callQaSettings.toastError'))
    }
  }

  return (
    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_CALL_QA}>
      <div
        data-testid="call-qa-settings-section"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icons.Activity01 size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-foreground text-sm font-medium">
              {t('pages.callQaSettings.title')}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {t('pages.callQaSettings.description')}
            </div>
          </div>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={handleToggle}
          disabled={isLoading || mutation.isPending}
          ariaLabel={t('pages.callQaSettings.toggleAria')}
        />
      </div>
    </PermissionGuard>
  )
}

export default CallQaSettingsSection
