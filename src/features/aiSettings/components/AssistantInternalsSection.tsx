/**
 * AssistantInternalsSection — «Устройство ассистента»: the read-only ops
 * view of the brain, sourced from GET /api/v1/ai-assistant/admin/overview
 * (api-prionex#1013, which itself proxies the brain's admin scope).
 *
 * One card: «Конфигурация» (model/commit, flag grid, limits) — the parts an
 * admin can only observe. Persona, the prompt0 append template and the
 * skill switches moved to AssistantManagementSection above, which renders
 * them as editors; keeping a second read-only copy here would leave two
 * versions of the same artifact on one page.
 *
 * Visible only under `manage_ai_settings`, same gate as the other sections
 * on this page. A brain_unreachable 502 (or any network failure) renders a
 * standalone warning card instead of the config card — it must never take
 * down AssistantSettingsSection/CallQaSettingsSection/AssistantAccessSection
 * above it.
 */
import { useTranslation } from 'react-i18next'

import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { useAssistantOverview } from '../hooks/useAssistantOverview'
import type { OverviewConfig, OverviewFlags } from '../api/assistantOverviewService'

const FLAG_ORDER: (keyof OverviewFlags)[] = [
  'thinking_mode_enabled',
  'skills_enabled',
  'hooks_enabled',
  'crm_mode',
  'memory_enabled',
  'knowledge_enabled',
  'query_router_enabled',
  'answer_eval_enabled',
  'tts_normalize_enabled',
  'corrector_enabled',
  'rbac_scope_enabled',
  'call_qa_enabled',
]

const LIMIT_ORDER: (keyof OverviewConfig['limits'])[] = [
  'max_turns',
  'turn_deadline_s',
  'sql_max_rows',
  'prompt_append_limit',
]

function FlagBadge({ on }: { on: boolean }) {
  const { t } = useTranslation('common')
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium',
        on ? 'bg-success-100 text-success-700' : 'bg-gray-100 text-gray-700'
      )}
    >
      {t(on ? 'pages.aiSettings.internals.on' : 'pages.aiSettings.internals.off')}
    </span>
  )
}

function CardHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
        {icon}
      </div>
      <div className="text-foreground text-sm font-medium">{title}</div>
    </div>
  )
}

function SectionSkeleton() {
  return (
    <div
      data-testid="assistant-internals-skeleton"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm"
    >
      <div className="bg-border h-4 w-40 animate-pulse rounded" />
      <div className="bg-border h-4 w-full animate-pulse rounded" />
      <div className="bg-border h-16 w-full animate-pulse rounded" />
    </div>
  )
}

export function AssistantInternalsSection() {
  const { t } = useTranslation('common')
  const { data, isLoading, isError } = useAssistantOverview()

  return (
    <PermissionGuard permission={PERMISSIONS.SYSTEM.MANAGE_AI_SETTINGS}>
      <div data-testid="assistant-internals-section" className="flex flex-col gap-3">
        <div>
          <div className="text-foreground text-sm font-medium">
            {t('pages.aiSettings.internals.title')}
          </div>
        </div>

        {isLoading && <SectionSkeleton />}

        {!isLoading && isError && (
          <div
            data-testid="assistant-internals-unavailable"
            className="border-border bg-card rounded-xl border p-6 text-center shadow-sm"
          >
            <Icons.Warning className="text-error-500 mx-auto h-6 w-6" strokeWidth={2} />
            <div className="text-foreground mt-2 text-sm font-medium">
              {t('pages.aiSettings.internals.unavailable')}
            </div>
          </div>
        )}

        {!isLoading && !isError && data && (
          <div
            data-testid="assistant-internals-config"
            className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4 shadow-sm"
          >
            <CardHeader
              icon={<Icons.Settings size={16} strokeWidth={2} />}
              title={t('pages.aiSettings.internals.configTitle')}
            />

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <div>
                <span className="text-muted-foreground">
                  {t('pages.aiSettings.internals.model')}:{' '}
                </span>
                <span className="text-foreground font-medium">{data.config.model}</span>
              </div>
              <div>
                <span className="text-muted-foreground">
                  {t('pages.aiSettings.internals.commit')}:{' '}
                </span>
                <span className="text-foreground font-mono">{data.config.commit}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
              {FLAG_ORDER.map((flag) => (
                <div key={flag} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground truncate">
                    {t(`pages.aiSettings.internals.flags.${flag}`)}
                  </span>
                  <FlagBadge on={Boolean(data.config.flags[flag])} />
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              {LIMIT_ORDER.map((limit) => (
                <div key={limit}>
                  <span className="text-muted-foreground">
                    {t(`pages.aiSettings.internals.limits.${limit}`)}:{' '}
                  </span>
                  <span className="text-foreground font-medium">
                    {String(data.config.limits[limit])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}

export default AssistantInternalsSection
