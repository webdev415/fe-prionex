/**
 * Editable list of TA Chain steps.
 *
 * Operates on local state controlled by the parent. Each step picks a
 * Target Action from the (active, non-hidden) TA list scoped to the
 * chain's department, lets the admin set delay and required flags,
 * and supports reordering.
 */

import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import { useContactTypes } from '@/features/clients/hooks/useClients'
import type { ContactSource } from '@/features/clients/api/types'
import type { TAChainStepIn } from '@/features/taChains/api/types'

interface ChainStepsEditorProps {
  steps: TAChainStepIn[]
  onChange: (next: TAChainStepIn[]) => void
  disabled?: boolean
}

export function ChainStepsEditor({ steps, onChange, disabled }: ChainStepsEditorProps) {
  const { t } = useTranslation('common')

  // Pull the full list of active TAs (the form's department picker decides
  // which subset is contextually relevant; we still allow any active TA so
  // an admin can re-use generic TAs across departments).
  const { data } = useTargetActions({ include_hidden: false })
  const allTAs = useMemo(() => data?.items ?? [], [data])
  const { data: contactTypes = [] } = useContactTypes('all')

  const contactSourceOptions = useMemo(() => {
    const sources = [
      ...new Set(
        contactTypes
          .map((ct) => ct.contact_source)
          .filter(
            (source): source is ContactSource => source === 'client' || source === 'recommender'
          )
      ),
    ]
    if (sources.length === 0) {
      return ['client', 'recommender'] as ContactSource[]
    }
    return sources.sort((a, b) => {
      if (a === b) return 0
      return a === 'client' ? -1 : 1
    })
  }, [contactTypes])

  const contactSourceLabel = (source: ContactSource) =>
    source === 'recommender'
      ? t('pages.taChains.steps.contactSourceRecommender', 'Recommender contacts')
      : t('pages.taChains.steps.contactSourceClient', 'Client contacts')

  // Auto-repair: legacy chains created with a bug had `contact_source = null`
  // for contact-type steps. When the TA list is loaded, normalize any such
  // step to 'client' so the admin's next Save persists a valid value.
  useEffect(() => {
    if (allTAs.length === 0) return
    const fieldTypeById = new Map(allTAs.map((ta) => [ta.id, ta.field_type]))
    let needsFix = false
    const next = steps.map((s) => {
      if (fieldTypeById.get(s.target_action_id) === 'contact' && !s.contact_source) {
        needsFix = true
        return { ...s, contact_source: 'client' as const }
      }
      return s
    })
    if (needsFix) onChange(next)
  }, [allTAs, steps, onChange])

  const update = (index: number, patch: Partial<TAChainStepIn>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s))
    onChange(next)
  }

  const remove = (index: number) => {
    onChange(steps.filter((_, i) => i !== index))
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= steps.length) return
    const next = steps.slice()
    const tmp = next[index]
    next[index] = next[target]
    next[target] = tmp
    onChange(next)
  }

  /**
   * Tick / untick a promise flag (KAN-1069).
   *
   * Ticking a second field of the same type is REFUSED, not applied — the
   * ticket is explicit that the earlier choice must not be silently undone.
   * The server enforces the same rule; doing it here too means the admin finds
   * out on the click rather than after filling in the rest of the form.
   *
   * The pairing rule ("both flags or neither") is deliberately NOT enforced
   * here: it cannot be, because ticking the first of a pair is always a step
   * through an invalid state on the way to a valid one. The server refuses the
   * save and its message is what the admin reads.
   */
  const togglePromiseFlag = (
    index: number,
    field: 'is_promise_date' | 'is_promise_amount',
    checked: boolean
  ) => {
    if (checked) {
      const takenBy = steps.findIndex((s, i) => i !== index && s[field])
      if (takenBy !== -1) {
        toast.error(
          field === 'is_promise_date'
            ? t(
                'pages.taChains.steps.promiseDateTaken',
                'Step {{step}} is already counted as the promise date. Untick it first.',
                { step: takenBy + 1 }
              )
            : t(
                'pages.taChains.steps.promiseAmountTaken',
                'Step {{step}} is already counted as the promise amount. Untick it first.',
                { step: takenBy + 1 }
              )
        )
        return
      }
    }
    update(index, { [field]: checked })
  }

  const addStep = () => {
    const firstTA = allTAs[0]
    if (!firstTA) return
    onChange([
      ...steps,
      {
        target_action_id: firstTA.id,
        is_required: true,
        delay_minutes: 0,
        not_in_the_past: false,
        contact_source: firstTA.field_type === 'contact' ? 'client' : null,
        contact_medium: firstTA.field_type === 'contact' ? 'phone' : undefined,
        show_closed_credits: false,
        is_promise_date: false,
        is_promise_amount: false,
      },
    ])
  }

  if (allTAs.length === 0) {
    return (
      <div className="border-warning-200 bg-warning-100 text-warning-700 rounded-md border p-3 text-xs">
        {t('pages.taChains.noTargetActionsHint')}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-foreground text-sm font-medium">
          {t('pages.taChains.steps.title')}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={addStep}
            className="bg-primary-300 text-primary-foreground hover:bg-primary-500 flex items-center gap-1 rounded-md px-3 py-1 text-xs"
          >
            <Icons.Add size={14} strokeWidth={2} />
            {t('pages.taChains.steps.add')}
          </button>
        )}
      </div>

      {steps.length === 0 && (
        <div className="border-border text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
          {t('pages.taChains.steps.empty')}
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {steps.map((step, index) => {
          const ta = allTAs.find((x) => x.id === step.target_action_id)
          return (
            <li
              key={index}
              className="border-border bg-card flex flex-col gap-2 rounded-md border p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-foreground text-xs font-semibold">
                  {t('pages.taChains.steps.stepLabel', { index: index + 1 })}
                </span>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      className="text-foreground border-border rounded border px-2 py-0.5 text-xs disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === steps.length - 1}
                      className="text-foreground border-border rounded border px-2 py-0.5 text-xs disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="border-error-200 text-error-600 hover:bg-error-50 rounded border px-2 py-0.5 text-xs"
                    >
                      {t('actions.delete')}
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground text-xs">
                    {t('pages.taChains.steps.targetAction')}
                  </label>
                  <Select
                    value={String(step.target_action_id)}
                    onValueChange={(v) => {
                      const newId = parseInt(v, 10)
                      const newTA = allTAs.find((x) => x.id === newId)
                      // Auto-default contact_source for contact-type TAs;
                      // clear it for any other type so we don't persist stale data.
                      const next: Partial<TAChainStepIn> = { target_action_id: newId }
                      if (newTA?.field_type === 'contact') {
                        next.contact_source = step.contact_source ?? 'client'
                        next.contact_medium = step.contact_medium ?? 'phone'
                      } else {
                        next.contact_source = null
                        next.contact_medium = undefined
                      }
                      update(index, next)
                    }}
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('pages.taChains.steps.selectTA')} />
                    </SelectTrigger>
                    <SelectContent>
                      {allTAs.map((opt) => (
                        <SelectItem key={opt.id} value={String(opt.id)}>
                          {opt.name} ({opt.field_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground text-xs">
                    {t('pages.taChains.steps.delayMinutes')}
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={String(step.delay_minutes ?? 0)}
                    onChange={(e) =>
                      update(index, {
                        delay_minutes: Math.max(0, parseInt(e.target.value || '0', 10)),
                      })
                    }
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="text-foreground flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={step.is_required ?? true}
                    onChange={(e) => update(index, { is_required: e.target.checked })}
                    disabled={disabled}
                  />
                  {t('pages.taChains.steps.required')}
                </label>
                {ta?.field_type === 'date' && (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={step.not_in_the_past ?? false}
                      onChange={(e) => update(index, { not_in_the_past: e.target.checked })}
                      disabled={disabled}
                    />
                    {t('pages.taChains.steps.notInPast')}
                  </label>
                )}
                {ta?.field_type === 'date' && (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={step.is_promise_date ?? false}
                      onChange={(e) =>
                        togglePromiseFlag(index, 'is_promise_date', e.target.checked)
                      }
                      disabled={disabled}
                    />
                    {t('pages.taChains.steps.countAsPromiseDate', 'Count as promise date')}
                  </label>
                )}
                {ta?.field_type === 'amount' && (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={step.is_promise_amount ?? false}
                      onChange={(e) =>
                        togglePromiseFlag(index, 'is_promise_amount', e.target.checked)
                      }
                      disabled={disabled}
                    />
                    {t('pages.taChains.steps.countAsPromiseAmount', 'Count as promise amount')}
                  </label>
                )}
              </div>

              {ta?.field_type === 'contact' && (
                <div className="flex flex-col gap-1">
                  <label className="text-muted-foreground text-xs">
                    {t('pages.taChains.steps.contactSource', 'Contact source')}
                  </label>
                  <Select
                    value={step.contact_source ?? 'client'}
                    onValueChange={(v) =>
                      update(index, { contact_source: v as 'client' | 'recommender' })
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {contactSourceOptions.map((source) => (
                        <SelectItem key={source} value={source}>
                          {contactSourceLabel(source)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {ta?.field_type === 'credit' && (
                <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={step.show_closed_credits ?? false}
                    onChange={(e) => update(index, { show_closed_credits: e.target.checked })}
                    disabled={disabled}
                    className="border-border h-4 w-4 rounded"
                  />
                  <span>{t('pages.taChains.steps.showClosedCredits', 'Show closed credits')}</span>
                </label>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
