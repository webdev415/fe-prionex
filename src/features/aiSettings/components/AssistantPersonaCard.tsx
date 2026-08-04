/**
 * «Персона» — the assistant's name / role / tone / language.
 *
 * The editable fields are whatever string-valued keys the overview actually
 * returns, minus the derived `apply` tag. Hardcoding the four current ones
 * would silently hide a field the brain adds later; labels fall back to the
 * raw key so a new field is at least reachable before it gets a translation.
 *
 * Saves send only the changed keys — the endpoint is a partial patch, and
 * echoing untouched fields back would overwrite a concurrent edit by
 * another admin with a stale value.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'

import type { OverviewPersona } from '../api/assistantOverviewService'
import { useUpdateAssistantPersona } from '../hooks/useAssistantAdmin'
import { classifyAssistantAdminError } from '../utils/adminErrors'
import { ApplyBadge } from './ApplyBadge'

type PersonaFields = Record<string, string>

function editableFields(persona: OverviewPersona): PersonaFields {
  const fields: PersonaFields = {}
  for (const [key, value] of Object.entries(persona)) {
    if (key !== 'apply' && typeof value === 'string') {
      fields[key] = value
    }
  }
  return fields
}

export function AssistantPersonaCard({ persona }: { persona: OverviewPersona }) {
  const { t } = useTranslation('common')
  const mutation = useUpdateAssistantPersona()

  // A content signature, not the object identity: react-query hands back a
  // fresh object on every cache write, and depending on identity would wipe
  // an in-progress edit on any unrelated refresh.
  const serverSignature = JSON.stringify(editableFields(persona))

  const [draft, setDraft] = useState<PersonaFields>(() => editableFields(persona))
  const [error, setError] = useState<string | null>(null)
  const [seededFrom, setSeededFrom] = useState(serverSignature)

  // Adjusted during render rather than in an effect (which cascades a second
  // render pass and trips react-hooks/set-state-in-effect).
  if (seededFrom !== serverSignature) {
    setSeededFrom(serverSignature)
    setDraft(JSON.parse(serverSignature) as PersonaFields)
    setError(null)
  }

  const server = JSON.parse(serverSignature) as PersonaFields
  const changed = Object.keys(draft).filter((key) => draft[key] !== server[key])

  const handleSave = async () => {
    setError(null)
    const patch: PersonaFields = {}
    for (const key of changed) patch[key] = draft[key]

    try {
      await mutation.mutateAsync(patch)
      toast.success(t('pages.aiSettings.management.persona.toastSaved'))
    } catch (caught) {
      const { kind, message } = classifyAssistantAdminError(caught)
      setError(
        kind === 'validation' && message ? message : t(`pages.aiSettings.management.errors.${kind}`)
      )
    }
  }

  return (
    <div
      data-testid="assistant-persona-card"
      className="border-border bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="bg-primary-100 text-primary-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
          <Icons.User size={16} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-foreground text-sm font-medium">
              {t('pages.aiSettings.management.persona.title')}
            </span>
            <ApplyBadge apply={persona.apply} />
          </div>
          <div className="text-muted-foreground mt-0.5 text-xs">
            {t('pages.aiSettings.management.persona.description')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {Object.keys(server).map((key) => (
          <Input
            key={key}
            data-testid={`assistant-persona-field-${key}`}
            inputSize="sm"
            label={t(`pages.aiSettings.management.persona.fields.${key}`, { defaultValue: key })}
            value={draft[key] ?? ''}
            disabled={mutation.isPending}
            onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
          />
        ))}
      </div>

      {error && (
        <p data-testid="assistant-persona-error" className="text-error-500 text-xs" role="alert">
          {error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={changed.length === 0}
          isLoading={mutation.isPending}
        >
          {t('pages.aiSettings.management.persona.save')}
        </Button>
      </div>
    </div>
  )
}

export default AssistantPersonaCard
