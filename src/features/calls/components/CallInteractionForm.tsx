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
  /**
   * The interaction subtype — Call, Messenger, Mail — by id rather than by
   * name. The name is a label; only the id can be filed, and carrying the
   * label is how this field came to be collected and then dropped.
   */
  channelId: number | null
  comment: string
}

/**
 * The same fields mid-edit, where the operator may not have chosen a result
 * yet. Saving requires `CallInteractionDraft`; restoring a minimised window
 * has to accept the half-filled shape.
 */
export type CallInteractionDraftState = Omit<CallInteractionDraft, 'resultId'> & {
  resultId: number | null
}

interface CallInteractionFormProps {
  results: InteractionOption[]
  reasons: InteractionOption[]
  channels: InteractionOption[]
  /** Rejecting the promise leaves the form up with what the operator typed. */
  onSave: (draft: CallInteractionDraft) => Promise<void> | void
  /** Shown once saved, in place of the form. */
  saved?: boolean
  /**
   * What the operator had already entered. The window unmounts when minimised,
   * so without this a half-written interaction is lost — and the caller is
   * still on the line to have to repeat it.
   */
  initialDraft?: Partial<CallInteractionDraftState>
  onDraftChange?: (draft: CallInteractionDraftState) => void
  /**
   * Filing is not possible yet — no client is selected, or the lookups the
   * interaction needs have not loaded. Distinct from `disabled`: the operator
   * can still type while the caller talks, they just cannot save it.
   */
  saveDisabled?: boolean
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
  saveDisabled = false,
  initialDraft,
  onDraftChange,
}: CallInteractionFormProps) {
  const { t } = useTranslation('common')
  const [resultId, setResultId] = useState<number | null>(initialDraft?.resultId ?? null)
  const [reasonId, setReasonId] = useState<number | null>(initialDraft?.reasonId ?? null)
  const [channelId, setChannelId] = useState<number | null>(
    initialDraft?.channelId ?? channels[0]?.id ?? null
  )
  const [comment, setComment] = useState(initialDraft?.comment ?? '')
  const [saving, setSaving] = useState(false)

  const report = (change: Partial<CallInteractionDraftState>) =>
    onDraftChange?.({ resultId, reasonId, channelId, comment, ...change })

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
  const canSave = resultId !== null && !saving && !disabled && !saveDisabled

  const handleSave = async () => {
    if (resultId === null) return
    setSaving(true)
    try {
      await onSave({ resultId, reasonId, channelId, comment: comment.trim() })
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
            onValueChange={(value) => {
              setResultId(Number(value))
              report({ resultId: Number(value) })
            }}
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
            onValueChange={(value) => {
              setReasonId(Number(value))
              // Filters the result list too; same staleness as the channel.
              setResultId(null)
              report({ reasonId: Number(value), resultId: null })
            }}
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
          <Select
            value={channelId === null ? undefined : String(channelId)}
            onValueChange={(value) => {
              setChannelId(Number(value))
              // The result list is filtered by channel, so a result chosen for
              // the previous one may not be in it any more. Radix falls back to
              // the placeholder, which reads as nothing selected while the id is
              // still set and still saveable — filing a result that does not
              // apply to the channel it was filed under.
              setResultId(null)
              report({ channelId: Number(value), resultId: null })
            }}
            disabled={disabled}
          >
            <SelectTrigger id="call-interaction-channel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Textarea
        value={comment}
        onChange={(event) => {
          setComment(event.target.value)
          report({ comment: event.target.value })
        }}
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
