import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

export interface InteractionOption {
  id: number
  name: string
}

export interface CallInteractionDraft {
  resultId: number
  reasonId: number | null
  channel: string
  comment: string
}

interface CallInteractionFormProps {
  results: InteractionOption[]
  reasons: InteractionOption[]
  channels: InteractionOption[]
  /** Rejecting the promise leaves the form up with what the operator typed. */
  onSave: (draft: CallInteractionDraft) => Promise<void> | void
  /** Shown once saved, in place of the form. */
  saved?: boolean
  disabled?: boolean
}

/**
 * The interaction an operator files while the call is still connected.
 *
 * Presentational on purpose: the options and the write are supplied by the
 * caller. Which contract the interaction attaches to is the caller's business
 * too — this component never decides that.
 */
export function CallInteractionForm({
  results,
  reasons,
  channels,
  onSave,
  saved = false,
  disabled = false,
}: CallInteractionFormProps) {
  const { t } = useTranslation('common')
  const [resultId, setResultId] = useState<number | null>(null)
  const [reasonId, setReasonId] = useState<number | null>(null)
  const [channel, setChannel] = useState<string>(channels[0]?.name ?? '')
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)

  if (saved) {
    return (
      <div
        role="status"
        className="border-success-500/30 bg-success-50 text-success-700 flex flex-col items-center gap-1 rounded-lg border px-4 py-5 text-center"
      >
        <Icons.Checkmark size={20} strokeWidth={1.5} aria-hidden />
        <span className="text-sm font-medium">
          {t('pages.clients.modals.callDialog.interaction.saved', 'Interaction saved')}
        </span>
      </div>
    )
  }

  // The one field that gates saving; everything else is optional by design.
  const canSave = resultId !== null && !saving && !disabled

  const handleSave = async () => {
    if (resultId === null) return
    setSaving(true)
    try {
      await onSave({ resultId, reasonId, channel, comment: comment.trim() })
    } catch {
      // Swallowed on purpose: the caller owns the failure message, and the form
      // stays up with what the operator typed. Rethrowing here would surface as
      // an unhandled rejection and lose a comment written mid-call.
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="bg-border h-px flex-1" />
        <span className="text-muted-foreground text-xs font-medium">
          {t('pages.clients.modals.callDialog.interaction.title', 'Interaction Form')}
        </span>
        <span className="bg-border h-px flex-1" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field
          label={t('pages.clients.modals.callDialog.interaction.result', 'Result')}
          required
          htmlFor="call-interaction-result"
        >
          <Select
            value={resultId === null ? undefined : String(resultId)}
            onValueChange={(value) => setResultId(Number(value))}
            disabled={disabled}
          >
            <SelectTrigger
              id="call-interaction-result"
              className={cn('w-full', resultId === null && 'border-error-500')}
            >
              <SelectValue
                placeholder={t(
                  'pages.clients.modals.callDialog.interaction.selectResult',
                  'Select a result'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {results.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t('pages.clients.modals.callDialog.interaction.reason', 'Reason for contact')}
          htmlFor="call-interaction-reason"
        >
          <Select
            value={reasonId === null ? undefined : String(reasonId)}
            onValueChange={(value) => setReasonId(Number(value))}
            disabled={disabled}
          >
            <SelectTrigger id="call-interaction-reason" className="w-full">
              <SelectValue
                placeholder={t(
                  'pages.clients.modals.callDialog.interaction.selectReason',
                  'Select a reason'
                )}
              />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label={t('pages.clients.modals.callDialog.interaction.channel', 'Communication channel')}
          htmlFor="call-interaction-channel"
        >
          <Select value={channel} onValueChange={setChannel} disabled={disabled}>
            <SelectTrigger id="call-interaction-channel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((option) => (
                <SelectItem key={option.id} value={option.name}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        disabled={disabled}
        rows={3}
        aria-label={t('pages.clients.modals.callDialog.interaction.comment', 'Comment')}
        placeholder={t(
          'pages.clients.modals.callDialog.interaction.commentPlaceholder',
          'Add a comment to the interaction...'
        )}
      />

      <Button
        variant="primary"
        size="sm"
        onClick={handleSave}
        disabled={!canSave}
        className="w-full rounded-md"
      >
        <Icons.Checkmark size={18} className="mr-2" strokeWidth={1.5} aria-hidden />
        {t('pages.clients.modals.callDialog.interaction.save', 'Save Interaction')}
      </Button>
    </div>
  )
}

function Field({
  label,
  required = false,
  htmlFor,
  children,
}: {
  label: string
  required?: boolean
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-muted-foreground text-xs">
        {label}
        {required && <span className="text-error-500"> *</span>}
      </label>
      {children}
    </div>
  )
}
