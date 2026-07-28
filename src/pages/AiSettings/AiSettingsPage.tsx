/**
 * AiSettingsPage — the «AI Settings» admin page (system-settings/ai).
 *
 * Three self-guarded sections: the global assistant kill-switch
 * (manage_ai_settings), the Call QA «AI call analysis» switch moved here
 * from the IP-whitelist page (manage_call_qa), and assistant access by
 * role (manage_roles). The route lets in anyone holding at least one of
 * those permissions; each section hides itself for the rest.
 */
import { useTranslation } from 'react-i18next'

import { AssistantAccessSection } from '@/features/aiSettings/components/AssistantAccessSection'
import { AssistantInternalsSection } from '@/features/aiSettings/components/AssistantInternalsSection'
import { AssistantSettingsSection } from '@/features/aiSettings/components/AssistantSettingsSection'
import { CallQaSettingsSection } from '@/features/quality/components/CallQaSettingsSection'

export function AiSettingsPage() {
  const { t } = useTranslation('common')

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-xl font-light sm:text-2xl">
          {t('pages.aiSettings.title')}
        </h1>
        <p className="text-muted-foreground text-sm font-light">{t('pages.aiSettings.helper')}</p>
      </div>

      <AssistantSettingsSection />
      <CallQaSettingsSection />
      <AssistantAccessSection />
      <AssistantInternalsSection />
    </div>
  )
}

export default AiSettingsPage
