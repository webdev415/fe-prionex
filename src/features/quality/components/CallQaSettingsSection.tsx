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
        className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="text-dark-500 text-sm font-medium">{t('pages.callQaSettings.title')}</div>
          <div className="text-xs text-gray-500">{t('pages.callQaSettings.description')}</div>
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
