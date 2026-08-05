/**
 * «Управление ассистентом» — the editable half of the AI settings page:
 * persona, the prompt0 append template, and the skill switches, all served
 * off the same GET /admin/overview the read-only internals card uses.
 *
 * These three cards are where persona / append / skills now live; the
 * internals card below keeps the genuinely read-only ops view (model,
 * commit, flags, limits). Showing the same artifact twice on one page — once
 * as a `<pre>` and once as an input — is how an admin ends up editing the
 * copy that isn't wired to anything.
 *
 * Gated by `manage_ai_settings`, same as every other section here; the
 * three PUTs are gated by it server-side too. A brain that cannot be
 * reached renders one warning card instead of the three editors — never a
 * form that silently fails on submit.
 */
import { useTranslation } from 'react-i18next'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'

import { useAssistantOverview } from '../hooks/useAssistantOverview'
import { AssistantPersonaCard } from './AssistantPersonaCard'
import { AssistantPromptAppendCard } from './AssistantPromptAppendCard'
import { AssistantSkillsCard } from './AssistantSkillsCard'
import { ApplyBadge } from './ApplyBadge'

function SectionSkeleton() {
  return (
    <div
      data-testid="assistant-management-skeleton"
      className="border-border bg-card flex animate-pulse flex-col gap-3 rounded-xl border p-4 shadow-sm"
    >
      <div className="bg-border h-4 w-40 rounded" />
      <div className="bg-border h-4 w-full rounded" />
      <div className="bg-border h-16 w-full rounded" />
    </div>
  )
}

export function AssistantManagementSection() {
  const { t } = useTranslation('common')
  const { data, isLoading, isError } = useAssistantOverview()

  return (
    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS}>
      <div data-testid="assistant-management-section" className="flex flex-col gap-3">
        <div>
          <div className="text-foreground text-sm font-medium">
            {t('pages.aiSettings.management.title')}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {t('pages.aiSettings.management.helper')}
          </div>
        </div>

        {isLoading && <SectionSkeleton />}

        {!isLoading && isError && (
          <div
            data-testid="assistant-management-unavailable"
            className="border-border bg-card rounded-xl border p-6 text-center shadow-sm"
          >
            <Icons.Warning className="text-error-500 mx-auto h-6 w-6" strokeWidth={2} />
            <div className="text-foreground mt-2 text-sm font-medium">
              {t('pages.aiSettings.management.errors.unavailable')}
            </div>
          </div>
        )}

        {!isLoading && !isError && data && (
          <>
            <AssistantPersonaCard persona={data.prompts.persona} />
            <AssistantPromptAppendCard overview={data} />
            <AssistantSkillsCard skills={data.prompts.skills} />

            <div
              data-testid="assistant-knowledge-card"
              className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-foreground text-sm font-medium">
                  {t('pages.aiSettings.internals.knowledge')}
                </span>
                <ApplyBadge apply={data.prompts.knowledge.apply} />
              </div>
              <ul className="text-foreground list-disc pl-5 text-sm">
                {data.prompts.knowledge.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </PermissionGuard>
  )
}

export default AssistantManagementSection
