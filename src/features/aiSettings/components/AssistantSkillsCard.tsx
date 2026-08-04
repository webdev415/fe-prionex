/**
 * «Навыки» — one row per brain skill with an on/off switch.
 *
 * Disabled skills stay in the list, marked, rather than disappearing: an
 * admin has to be able to find a skill again to turn it back on, and a
 * shrinking list would read as "the skill was deleted".
 *
 * The switch is optimistic (see useUpdateAssistantSkill) — on failure the
 * previous overview is restored and the reason is toasted, so the row
 * snapping back is never silent.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { isSkillEnabled, type OverviewSkill } from '../api/assistantOverviewService'
import { useUpdateAssistantSkill } from '../hooks/useAssistantAdmin'
import { classifyAssistantAdminError } from '../utils/adminErrors'
import { ApplyBadge } from './ApplyBadge'

function SkillRow({ skill }: { skill: OverviewSkill }) {
  const { t } = useTranslation('common')
  const mutation = useUpdateAssistantSkill()
  const [expanded, setExpanded] = useState(false)

  const enabled = isSkillEnabled(skill)

  const handleToggle = async (next: boolean) => {
    try {
      await mutation.mutateAsync({ name: skill.name, enabled: next })
      toast.success(
        next
          ? t('pages.aiSettings.management.skills.toastEnabled', { skill: skill.name })
          : t('pages.aiSettings.management.skills.toastDisabled', { skill: skill.name })
      )
    } catch (error) {
      const { kind, message } = classifyAssistantAdminError(error)
      toast.error(
        kind === 'validation' && message ? message : t(`pages.aiSettings.management.errors.${kind}`)
      )
    }
  }

  return (
    <div data-testid={`assistant-skill-row-${skill.name}`} className="flex flex-col gap-1 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium',
                enabled ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {skill.name}
            </span>
            {!enabled && (
              <span
                data-testid={`assistant-skill-off-badge-${skill.name}`}
                className="inline-flex shrink-0 items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
              >
                {t('pages.aiSettings.management.skills.disabledBadge')}
              </span>
            )}
            <ApplyBadge apply={skill.apply} />
          </div>
          {skill.description && (
            <div className="text-muted-foreground mt-0.5 text-xs">{skill.description}</div>
          )}
          {skill.text && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="text-muted-foreground hover:text-foreground mt-1 cursor-pointer text-xs underline"
            >
              {t(
                expanded
                  ? 'pages.aiSettings.management.skills.hideText'
                  : 'pages.aiSettings.management.skills.showText'
              )}
            </button>
          )}
        </div>
        <ToggleSwitch
          checked={enabled}
          onChange={handleToggle}
          disabled={mutation.isPending}
          ariaLabel={t('pages.aiSettings.management.skills.toggleAria', { skill: skill.name })}
        />
      </div>
      {expanded && skill.text && (
        <pre className="bg-muted text-foreground mt-1 max-h-64 overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">
          {skill.text}
        </pre>
      )}
    </div>
  )
}

export function AssistantSkillsCard({ skills }: { skills: OverviewSkill[] }) {
  const { t } = useTranslation('common')

  return (
    <div
      data-testid="assistant-skills-card"
      className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <Icons.Sparkles size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="text-foreground text-sm font-medium">
            {t('pages.aiSettings.management.skills.title')}
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {t('pages.aiSettings.management.skills.description')}
          </div>
        </div>
      </div>

      {skills.length === 0 ? (
        <div className="text-muted-foreground py-2 text-sm">
          {t('pages.aiSettings.management.skills.empty')}
        </div>
      ) : (
        <div className="divide-border divide-y">
          {skills.map((skill) => (
            <SkillRow key={skill.name} skill={skill} />
          ))}
        </div>
      )}
    </div>
  )
}

export default AssistantSkillsCard
