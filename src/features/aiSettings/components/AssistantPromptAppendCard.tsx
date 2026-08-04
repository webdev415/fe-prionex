/**
 * «Системная надстройка» — the prompt0 append template, editable.
 *
 * The character limit is server-owned (`prompt0_append.limit`, falling back
 * to `config.limits.prompt_append_limit`): the brain truncates past it, and
 * a hardcoded number here would drift the moment the brain's own limit
 * moves. Over-limit disables Save, but the text is never trimmed for the
 * user — losing what someone typed is worse than a blocked button.
 *
 * A 422 keeps the draft on screen and shows the server's message verbatim:
 * that text is the only place the admin learns what the brain rejected.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

import type { AssistantOverview } from '../api/assistantOverviewService'
import { useUpdateAssistantPromptAppend } from '../hooks/useAssistantAdmin'
import { classifyAssistantAdminError } from '../utils/adminErrors'
import { ApplyBadge } from './ApplyBadge'

export function AssistantPromptAppendCard({ overview }: { overview: AssistantOverview }) {
  const { t } = useTranslation('common')
  const mutation = useUpdateAssistantPromptAppend()

  const append = overview.prompts.prompt0_append
  const limit = append.limit || overview.config.limits.prompt_append_limit
  const serverText = append.text ?? ''

  const [draft, setDraft] = useState(serverText)
  const [error, setError] = useState<string | null>(null)
  const [seededFrom, setSeededFrom] = useState(serverText)

  // Re-seed only when the stored template actually changes (our own save,
  // or a first load). A 422 leaves the server value untouched, so a
  // rejected draft survives on screen — which is the point. Adjusted during
  // render rather than in an effect: the effect version cascades a second
  // render pass on every save (react-hooks/set-state-in-effect).
  if (seededFrom !== serverText) {
    setSeededFrom(serverText)
    setDraft(serverText)
    setError(null)
  }

  const overLimit = draft.length > limit
  const dirty = draft !== serverText

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
          className={cn(
            'text-xs',
            overLimit ? 'text-error-500 font-medium' : 'text-muted-foreground'
          )}
        >
          {draft.length}/{limit}
        </span>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || overLimit}
          isLoading={mutation.isPending}
        >
          {t('pages.aiSettings.management.prompt.save')}
        </Button>
      </div>
    </div>
  )
}

export default AssistantPromptAppendCard
