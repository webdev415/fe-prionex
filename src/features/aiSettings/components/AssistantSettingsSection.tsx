/**
 * AssistantSettingsSection — admin card with the global assistant
 * kill-switch. Mirrors CallQaSettingsSection: title + description on the
 * left, ToggleSwitch on the right, toasts on success/error.
 *
 * Visible only under `manage_ai_settings`; the PUT is server-gated by the
 * same permission. While the switch is OFF the assistant surface answers
 * 503 assistant_disabled and the header assistant button hides.
 */
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'

import {
  useAiAssistantSettings,
  useUpdateAiAssistantSettings,
} from '../hooks/useAiAssistantSettings'

export function AssistantSettingsSection() {
  const { t } = useTranslation('common')
  const { data: settings, isLoading } = useAiAssistantSettings()
  const mutation = useUpdateAiAssistantSettings()

  const enabled = settings?.assistant_enabled !== false

  const handleToggle = async (next: boolean) => {
    try {
      await mutation.mutateAsync({ assistant_enabled: next })
      toast.success(next ? t('pages.aiSettings.toastEnabled') : t('pages.aiSettings.toastDisabled'))
    } catch {
      toast.error(t('pages.aiSettings.toastError'))
    }
  }

  return (
    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS}>
      <div
        data-testid="assistant-settings-section"
        className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icons.AiBrain03 size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <div className="text-foreground text-sm font-medium">
              {t('pages.aiSettings.assistantToggleTitle')}
            </div>
            <div className="text-muted-foreground mt-0.5 text-xs">
              {t('pages.aiSettings.assistantToggleDescription')}
            </div>
          </div>
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={handleToggle}
          disabled={isLoading || mutation.isPending}
          ariaLabel={t('pages.aiSettings.assistantToggleAria')}
        />
      </div>
    </PermissionGuard>
  )
}

export default AssistantSettingsSection
