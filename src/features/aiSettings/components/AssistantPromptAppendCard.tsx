/**
 * «Системная надстройка» — the prompt0 append template, editable.
 *
 * The textarea holds `template` (raw, with `{name}` / `{role}` / `{tone}`
 * placeholders), never the rendered `text` — editing the render would bake
 * the substituted values in permanently on the next save.
 *
 * The counter is deliberately NOT `template.length`. The brain checks its
 * limit against the RENDERED text, and a 6-character `{name}` expands to
 * whatever the persona name is, so a local character count would confidently
 * report a number nobody validates against. Instead the card shows the
 * server's own `length`/`limit` from the last response and marks it stale
 * while there are unsaved edits — and never blocks Save on a local guess.
 * The brain validates and answers 422 with a readable reason.
 *
 * A 422 keeps the draft on screen and shows that message verbatim: it is
 * the only place the admin learns what was rejected.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'

import type { AssistantOverview } from '../api/assistantOverviewService'
import { useUpdateAssistantPromptAppend } from '../hooks/useAssistantAdmin'
import { classifyAssistantAdminError } from '../utils/adminErrors'
import { ApplyBadge } from './ApplyBadge'
import { OverriddenBadge } from './OverriddenBadge'

export function AssistantPromptAppendCard({ overview }: { overview: AssistantOverview }) {
  const { t } = useTranslation('common')
  const mutation = useUpdateAssistantPromptAppend()

  const append = overview.prompts.prompt0_append
  const limit = append.limit || overview.config.limits.prompt_append_limit
  const serverTemplate = append.template ?? ''

  const [draft, setDraft] = useState(serverTemplate)
  const [error, setError] = useState<string | null>(null)
  const [seededFrom, setSeededFrom] = useState(serverTemplate)

  // Re-seed only when the stored template actually changes (our own save,
  // or a first load). A 422 leaves the server value untouched, so a
  // rejected draft survives on screen — which is the point. Adjusted during
  // render rather than in an effect: the effect version cascades a second
  // render pass on every save (react-hooks/set-state-in-effect).
  if (seededFrom !== serverTemplate) {
    setSeededFrom(serverTemplate)
    setDraft(serverTemplate)
    setError(null)
  }

  const dirty = draft !== serverTemplate

  const handleSave = async () => {
    setError(null)
    try {
      await mutation.mutateAsync(draft)
      toast.success(t('pages.aiSettings.management.prompt.toastSaved'))
    } catch (caught) {
      const { kind, message } = classifyAssistantAdminError(caught)
      setError(
        kind === 'validation' && message ? message : t(`pages.aiSettings.management.errors.${kind}`)
      )
    }
  }

  return (
    <div
      data-testid="assistant-prompt-append-card"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <Icons.AiBrain03 size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-sm font-medium">
              {t('pages.aiSettings.management.prompt.title')}
            </span>
            <ApplyBadge apply={append.apply} />
            <OverriddenBadge overridden={append.overridden} />
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {t('pages.aiSettings.management.prompt.description')}
          </div>
        </div>
      </div>

      <div
        data-testid="assistant-prompt-append-warning"
        className="border-warning-500/40 bg-warning-100/60 flex items-start gap-2 rounded-lg border p-3"
      >
        <Icons.Warning className="text-warning-700 mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
        <div className="text-warning-700 text-xs">
          {t('pages.aiSettings.management.prompt.warning')}
        </div>
      </div>

      {append.error && (
        <div
          data-testid="assistant-prompt-append-render-error"
          className="border-error-500/40 bg-error-100/60 flex items-start gap-2 rounded-lg border p-3"
        >
          <Icons.Warning className="text-error-700 mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
          <div className="text-error-700 min-w-0 text-xs">
            <div className="font-medium">
              {t('pages.aiSettings.management.prompt.renderErrorTitle')}
            </div>
            <div className="mt-0.5 break-words">{append.error}</div>
          </div>
        </div>
      )}

      <Textarea
        data-testid="assistant-prompt-append-input"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={mutation.isPending}
        textareaSize="lg"
        aria-label={t('pages.aiSettings.management.prompt.inputAria')}
        error={error ?? undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          data-testid="assistant-prompt-append-counter"
          className="text-muted-foreground text-xs"
        >
          {append.length}/{limit} · {t('pages.aiSettings.management.prompt.counterLabel')}
          {dirty && ` · ${t('pages.aiSettings.management.prompt.counterStale')}`}
        </span>
        <Button size="sm" onClick={handleSave} disabled={!dirty} isLoading={mutation.isPending}>
          {t('pages.aiSettings.management.prompt.save')}
        </Button>
      </div>
    </div>
  )
}

export default AssistantPromptAppendCard
