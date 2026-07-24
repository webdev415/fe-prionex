/**
 * EditTAInteractionModal — admin edit of a saved TA chain interaction.
 *
 * Surfaces every step's recorded value (from `step_data`) plus top-level
 * promise-date / promise-amount / credit / notes. Step rendering mirrors
 * ChainExecutor by field_type so the editor matches what was originally
 * entered. Submits to PUT /api/v1/ta-interactions/{id}.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  getDateTimeStringInTimezone,
  isWallTimeInPast,
  wallTimeAsTimezoneToUtcIso,
} from '@/lib/dateUtils'
import { useAuthStore } from '@/stores/authStore'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import {
  useClientChainInstances,
  useTAInteraction,
  useUpdateTAInteraction,
} from '@/features/taInteractions/hooks/useTAInteractions'
import { useTAChain } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import { resolveStepValue, visibleCredits } from './taFieldMapping'
import { useClientEmails } from '@/features/clients/hooks/useClientEmails'
import { useClientPhones } from '@/features/clients/hooks/useClientPhones'
import type { ContactMedium } from '@/features/taChains/api/types'
import type { ContactSource } from '@/features/taChains/api/types'
import { getErrorMessage } from '@/lib/errors'
import { formatMoneyKopeckTight } from '@/lib/formatters'

// Shared display/entry format for the manually-typeable date field.
const MANUAL_DATE_FORMAT = 'dd.MM.yyyy HH:mm'
const MANUAL_DATE_DEFAULT_TIME = '09:00'

// "Date cannot be in the past" (KAN-578): the calendar disables past days +
// past time slots; manual typing can still enter a past value, which is
// flagged inline and blocked on save. Values here are naive browser-local
// strings, so the checks use browser-local "now".
function stepDateIsPast(value: string, notInPast: boolean | undefined): boolean {
  if (!notInPast || !value) return false
  return isWallTimeInPast(value)
}

// Stable, module-level time-slot predicate (keep future slots; grey out past
// slots for today). Hoisted so react-datepicker sees a stable identity.
const filterFromNow = (time: Date): boolean => {
  const now = new Date()
  const isSameDay =
    time.getFullYear() === now.getFullYear() &&
    time.getMonth() === now.getMonth() &&
    time.getDate() === now.getDate()
  return isSameDay ? time.getTime() >= now.getTime() : true
}

// Calendar bounds for a not-in-the-past step: block past days + past times.
function notInPastBounds(notInPast: boolean | undefined) {
  if (!notInPast) return {}
  return { min: new Date(), filterTime: filterFromNow }
}

// Mirrors ChainExecutor's helper of the same name. A date-type step value
// comes out of the picker as a naive "YYYY-MM-DDTHH:mm" wall time; convert
// it to a UTC ISO string (with a trailing Z) using the user's profile
// timezone so EDITED dates persist in the SAME format the create/wizard
// path stores. Without this the edit path saved the naive wall time as-is
// (no Z); the display layer then treated that as UTC and re-shifted it by
// the profile offset — the "date jumps +N hours after editing" bug.
// Non-date values and already-absolute strings (Z / ±HH:MM) pass through.
function toUtcIsoIfDate(
  value: string | null | undefined,
  fieldType: string | null | undefined,
  profileTimezone: string | null | undefined
): string | null {
  if (!value) return null
  if (fieldType !== 'date') return value
  if (/[Zz]$|[+-]\d{2}:\d{2}$/.test(value)) return value // already absolute
  if (!profileTimezone) {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toISOString()
  }
  return wallTimeAsTimezoneToUtcIso(value, profileTimezone)
}

function ContactStepEdit({
  clientId,
  source,
  contactMedium,
  value,
  onChange,
}: {
  clientId: number
  source: ContactSource | null
  contactMedium?: ContactMedium
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation('common')
  const isEmail = contactMedium === 'email'
  const { data: phonesData } = useClientPhones(clientId, !isEmail ? (source ?? 'client') : null)
  const { data: emailsData } = useClientEmails(clientId, isEmail ? (source ?? 'client') : null)
  // step_data stores the contact string verbatim, so the Select compares
  // by contact_value not id. If the saved value isn't in the current
  // list (contact deleted/renamed), still show it as a stale entry.
  const contacts = (isEmail ? emailsData : phonesData) ?? []
  const valueIsKnown = contacts.some((p) => p.contact_value === value)
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder={t('pages.clientChains.selectValue', 'Select…')} />
      </SelectTrigger>
      <SelectContent>
        {!valueIsKnown && value !== '' && (
          <SelectItem value={value}>
            {value}
            <span className="ml-2 text-xs text-gray-400">
              {t('pages.clientChains.contactStale', '(stale)')}
            </span>
          </SelectItem>
        )}
        {contacts.map((p) => (
          <SelectItem key={p.id} value={p.contact_value}>
            {p.contact_value}
            {p.type_name ? ` (${p.type_name})` : ''}
            {source === 'recommender' && p.comment ? ` — ${p.comment}` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function EditInteractionSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <div className="h-9 animate-pulse rounded-lg border border-gray-200 bg-gray-100" />
      {Array.from({ length: 4 }).map((_, idx) => (
        <div key={idx} className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-md bg-gray-200" />
        </div>
      ))}
      <div className="space-y-2">
        <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
        <div className="h-20 w-full animate-pulse rounded-md bg-gray-200" />
      </div>
    </div>
  )
}

interface Props {
  open: boolean
  interactionId: number | null
  onClose: () => void
  onSaved?: () => void
  debts?: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
    days_past_due?: number | null
    seller_company?: string | null
    status?: string | null
  }>
}

export function EditTAInteractionModal({
  open,
  interactionId,
  onClose,
  onSaved,
  debts = [],
}: Props) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()

  const { data: interaction } = useTAInteraction(open ? interactionId : null)
  const { data: chain } = useTAChain(interaction?.chain_id ?? null)
  const { data: tasData } = useTargetActions({ include_hidden: true })
  // Wizard snapshots (chain_instances.step_data) are an authoritative
  // backup of every step's value. We merge them with interaction.step_data
  // so steps that didn't make it into ta_interactions.step_data still
  // hydrate from the snapshot.
  const { data: clientInstances } = useClientChainInstances(
    open && interaction?.client_id ? interaction.client_id : null
  )
  const matchingInstance = useMemo(() => {
    if (!interaction?.chain_instance_id || !clientInstances) return null
    return clientInstances.find((i) => i.id === interaction.chain_instance_id) ?? null
  }, [interaction?.chain_instance_id, clientInstances])

  const taById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof tasData>['items'][number]>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  const updateMut = useUpdateTAInteraction()

  // Local form state — keyed by step.id (unique per step). We can't key by
  // target_action_id because chains may reuse the same TA across multiple steps,
  // which would collide and lose values on lookup AND on save.
  const [seenInteractionId, setSeenInteractionId] = useState<number | null>(null)
  const [stepValues, setStepValues] = useState<Record<string, string>>({})
  const [promiseDate, setPromiseDate] = useState<string>('')
  const [promiseAmount, setPromiseAmount] = useState<string>('')
  const [creditId, setCreditId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')
  // step.id values whose date field currently holds invalid/incomplete text.
  const [invalidDateSteps, setInvalidDateSteps] = useState<Set<number>>(new Set())

  const setDateValidity = (stepId: number, invalid: boolean) =>
    setInvalidDateSteps((prev) => {
      const has = prev.has(stepId)
      if (invalid === has) return prev
      const next = new Set(prev)
      if (invalid) next.add(stepId)
      else next.delete(stepId)
      return next
    })

  // Hydrate once interaction + chain definition + (if applicable) instance are
  // all loaded, so we don't overwrite the user's edits when a slower query
  // arrives later.
  const stillWaitingForInstance =
    interaction?.chain_instance_id != null && clientInstances === undefined
  const stillWaitingForChain = interaction != null && chain == null
  if (
    interaction &&
    interaction.id !== seenInteractionId &&
    !stillWaitingForInstance &&
    !stillWaitingForChain
  ) {
    setSeenInteractionId(interaction.id)

    const next: Record<string, string> = {}
    const sortedSteps = chain?.steps
      ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
      : []
    // Resolve each step's value step-specifically (by step_order). The legacy
    // target_action_id fallback is only used when a single step uses that TA —
    // otherwise an empty step (e.g. a loan field) could inherit another step's
    // value (e.g. a phone). See taFieldMapping.ts (Bug 2).
    for (const step of sortedSteps) {
      next[String(step.id)] = resolveStepValue(
        step,
        sortedSteps,
        matchingInstance?.step_data,
        interaction.step_data
      )
    }
    setStepValues(next)
    setPromiseDate(interaction.promise_date ? interaction.promise_date.slice(0, 10) : '')
    setPromiseAmount(interaction.promise_amount ?? '')
    setCreditId(interaction.credit_id != null ? String(interaction.credit_id) : '')
    setNotes(interaction.notes ?? '')
  }

  const orderedSteps = useMemo(() => {
    if (!chain?.steps) return []
    return [...chain.steps].sort((a, b) => a.step_order - b.step_order)
  }, [chain])

  // Detect which optional fields the chain can actually collect, based on
  // dropdown options present in any step's TA. We *also* surface a field if
  // the saved interaction has a value for it, so admins can clear stale data
  // even if the chain definition has since changed.
  const chainCapabilities = useMemo(() => {
    let promiseDate = false
    let promiseAmount = false
    let credit = false
    for (const step of orderedSteps) {
      const ta = taById.get(step.target_action_id)
      if (!ta || ta.field_type !== 'dropdown') continue
      for (const dv of ta.dropdown_values) {
        if (dv.require_promise_date) promiseDate = true
        if (dv.require_promise_amount) promiseAmount = true
        if (dv.require_credit) credit = true
      }
    }
    return { promiseDate, promiseAmount, credit }
  }, [orderedSteps, taById])

  const showPromiseDate = chainCapabilities.promiseDate || !!interaction?.promise_date
  const showPromiseAmount = chainCapabilities.promiseAmount || !!interaction?.promise_amount
  const showCredit = chainCapabilities.credit || interaction?.credit_id != null

  const handleSave = async () => {
    if (!interaction) return

    // Block invalid/incomplete manual date entries.
    if (invalidDateSteps.size > 0) {
      toast.error(t('pages.clientChains.errors.dateInvalid'))
      return
    }
    // Block past dates on steps that forbid them.
    for (const step of orderedSteps) {
      const ta = taById.get(step.target_action_id)
      if (ta?.field_type !== 'date') continue
      if (stepDateIsPast(stepValues[String(step.id)] ?? '', step.not_in_the_past)) {
        toast.error(t('pages.clientChains.errors.datePast'))
        return
      }
    }

    const trimmedNotes = notes.trim()
    // ``stepValues`` is keyed by ``step.id`` (unique per step row).
    // On save we re-key by ``step_order`` — the canonical convention
    // used by chain_automation (wizard path). Previously this code
    // wrote under ``target_action_id``, which collapsed values whenever
    // a chain reused the same Target Action across multiple steps:
    // both iterations targeted the same key and the later step's value
    // overwrote the earlier one. The history renderer falls back from
    // ``step_order`` to ``target_action_id``, so after that overwrite
    // every duplicate-TA step rendered the same value — visible as
    // duplicates in the Result column on every page load after an
    // edit-save. Writing by step_order keeps each step's slot
    // independent and matches the read path's primary lookup; the
    // fallback stays for legacy rows produced by the old edit path.
    const sortedStepsForSave = chain?.steps
      ? [...chain.steps].sort((a, b) => a.step_order - b.step_order)
      : []
    const cleanedStepData: Record<string, string> = {}
    for (const step of sortedStepsForSave) {
      const v = stepValues[String(step.id)]
      if (v !== undefined && v !== '') {
        // Convert date-type values to UTC ISO (with Z) so edits persist in
        // the same format as the create/wizard path; other types pass
        // through unchanged. See toUtcIsoIfDate above.
        const fieldType = taById.get(step.target_action_id)?.field_type
        cleanedStepData[String(step.step_order)] = toUtcIsoIfDate(v, fieldType, user?.timezone) ?? v
      }
    }

    try {
      await updateMut.mutateAsync({
        id: interaction.id,
        payload: {
          step_data: cleanedStepData,
          promise_date: promiseDate ? `${promiseDate}T00:00:00` : undefined,
          clear_promise_date: !promiseDate,
          promise_amount: promiseAmount ? parseFloat(promiseAmount) : undefined,
          clear_promise_amount: !promiseAmount,
          credit_id: creditId ? parseInt(creditId, 10) : undefined,
          clear_credit_id: !creditId,
          notes: trimmedNotes || '',
        },
      })
      toast.success(t('pages.clientChains.editInteraction.savedToast'))
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const setStepValue = (stepId: number, v: string) =>
    setStepValues((prev) => ({ ...prev, [String(stepId)]: v }))

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.PencilEdit size={22} className="text-dark-500" strokeWidth={1.8} />
          </div>
        }
        title={t('pages.clientChains.editInteraction.title')}
      />
      <ModalContent>
        {!interaction || !chain ? (
          <EditInteractionSkeleton />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {t('pages.clientChains.editInteraction.chainLabel')}:{' '}
              <span className="font-medium text-gray-800">{chain.name}</span>
            </div>

            {orderedSteps.map((step) => {
              const ta = taById.get(step.target_action_id)
              const value = stepValues[String(step.id)] ?? ''
              if (!ta) return null
              return (
                <div
                  key={step.id}
                  className="flex flex-col gap-1 rounded-lg border border-gray-200 bg-gray-50/50 p-3"
                >
                  <Label className="text-sm font-medium text-gray-800">
                    {t('pages.clientChains.stepLabel', { order: step.step_order })} — {ta.name}
                    {step.is_required && <span className="ml-1 text-red-500">*</span>}
                  </Label>
                  {ta.field_type === 'dropdown' ? (
                    <Select value={value} onValueChange={(v) => setStepValue(step.id, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('pages.clientChains.selectValue', 'Select…')} />
                      </SelectTrigger>
                      <SelectContent>
                        {ta.dropdown_values
                          .filter((dv) => !dv.is_hidden)
                          .map((dv) => (
                            <SelectItem key={dv.id} value={dv.value}>
                              {dv.value}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : ta.field_type === 'date' ? (
                    (() => {
                      const parsed = value ? new Date(value) : null
                      const isValid = !!parsed && !isNaN(parsed.getTime())
                      return (
                        <div className="flex flex-col gap-1">
                          <DateSelect
                            value={isValid ? parsed : null}
                            onChange={({ value: v }) =>
                              setStepValue(step.id, v ? getDateTimeStringInTimezone(v) : '')
                            }
                            onValidityChange={(invalid) => setDateValidity(step.id, invalid)}
                            allowManualInput
                            defaultTime={MANUAL_DATE_DEFAULT_TIME}
                            format={MANUAL_DATE_FORMAT}
                            showTimeSelect
                            timeFormat="HH:mm"
                            timeIntervals={15}
                            invalidText={t('pages.clientChains.errors.dateInvalid')}
                            error={
                              stepDateIsPast(value, step.not_in_the_past)
                                ? t('pages.clientChains.errors.datePast')
                                : undefined
                            }
                            {...notInPastBounds(step.not_in_the_past)}
                          />
                          {value && !isValid && (
                            <span className="text-xs text-amber-600">
                              {t('pages.clientChains.editInteraction.savedValue')}: {value}{' '}
                              <span className="text-amber-500">
                                {t('pages.clientChains.contactStale', '(stale)')}
                              </span>
                            </span>
                          )}
                        </div>
                      )
                    })()
                  ) : ta.field_type === 'amount' ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      leftIcon={<span className="text-gray-700">₴</span>}
                      value={value}
                      onChange={(e) => setStepValue(step.id, e.target.value)}
                    />
                  ) : ta.field_type === 'contact' ? (
                    <ContactStepEdit
                      clientId={interaction.client_id}
                      source={step.contact_source}
                      contactMedium={step.contact_medium}
                      value={value}
                      onChange={(v) => setStepValue(step.id, v)}
                    />
                  ) : ta.field_type === 'credit' ? (
                    (() => {
                      const selectedIds = value ? value.split(',').filter(Boolean) : []
                      const knownDebtIds = new Set(debts.map((d) => String(d.id)))
                      // Legacy interactions saved before the checkbox UI may
                      // have stored arbitrary text or contract numbers. Surface
                      // those as removable rows so the value isn't silently
                      // hidden when it doesn't map to any current debt.
                      const staleIds = selectedIds.filter((id) => !knownDebtIds.has(id))
                      // Respect the step's show_closed_credits flag (Bug 4):
                      // hide closed debts unless the flag is set, but keep any
                      // already-selected closed debt so it isn't dropped.
                      const shownDebts = visibleCredits(
                        debts,
                        step.show_closed_credits,
                        selectedIds
                      )
                      return (
                        <div className="flex flex-col gap-2">
                          {shownDebts.length === 0 && staleIds.length === 0 ? (
                            <span className="text-xs text-gray-500">
                              {t('pages.clientChains.noCredits')}
                            </span>
                          ) : (
                            <>
                              {shownDebts.map((d) => {
                                const creditKey = String(d.id)
                                const isChecked = selectedIds.includes(creditKey)
                                return (
                                  <label
                                    key={d.id}
                                    className="text-foreground border-border bg-card hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={(e) => {
                                        const next = e.target.checked
                                          ? [...selectedIds, creditKey]
                                          : selectedIds.filter((id) => id !== creditKey)
                                        setStepValue(step.id, next.filter(Boolean).join(','))
                                      }}
                                    />
                                    <span>
                                      #{d.contract_number ?? d.id}
                                      {d.seller_company ? ` — ${d.seller_company}` : ''}
                                      {d.remaining_debt_amount
                                        ? ` — ${formatMoneyKopeckTight(d.remaining_debt_amount)}`
                                        : ''}
                                      {d.days_past_due
                                        ? ` — ${t(
                                            'pages.clientChains.editInteraction.overdueDays',
                                            {
                                              count: d.days_past_due,
                                            }
                                          )}`
                                        : ''}
                                    </span>
                                  </label>
                                )
                              })}
                              {staleIds.map((id) => (
                                <label
                                  key={`stale-${id}`}
                                  className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 hover:bg-amber-100"
                                >
                                  <input
                                    type="checkbox"
                                    checked
                                    onChange={() => {
                                      const next = selectedIds.filter((s) => s !== id)
                                      setStepValue(step.id, next.filter(Boolean).join(','))
                                    }}
                                  />
                                  <span>
                                    {id}
                                    <span className="ml-2 text-xs text-amber-600">
                                      {t('pages.clientChains.contactStale', '(stale)')}
                                    </span>
                                  </span>
                                </label>
                              ))}
                            </>
                          )}
                        </div>
                      )
                    })()
                  ) : (
                    <Input
                      type="text"
                      placeholder={ta.name}
                      value={value}
                      onChange={(e) => setStepValue(step.id, e.target.value)}
                    />
                  )}
                </div>
              )
            })}

            {showPromiseDate && (
              <div className="flex flex-col gap-1">
                <Label className="text-sm text-gray-700">
                  {t('pages.clientChains.promiseDate')}
                </Label>
                <Input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                />
              </div>
            )}

            {showPromiseAmount && (
              <div className="flex flex-col gap-1">
                <Label className="text-sm text-gray-700">
                  {t('pages.clientChains.promiseAmountUAH')}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="0.00"
                  leftIcon={<span className="text-gray-700">₴</span>}
                  value={promiseAmount}
                  onChange={(e) => setPromiseAmount(e.target.value)}
                />
              </div>
            )}

            {showCredit && debts.length > 0 && (
              <div className="flex flex-col gap-1">
                <Label className="text-sm text-gray-700">
                  {t('pages.clientChains.credit', 'Credit')}
                </Label>
                <Select value={creditId} onValueChange={setCreditId}>
                  <SelectTrigger>
                    <SelectValue
                      placeholder={t('pages.clientChains.creditPlaceholder', 'Pick a credit…')}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {debts.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        #{d.contract_number ?? d.id}
                        {d.remaining_debt_amount
                          ? ` — ${formatMoneyKopeckTight(d.remaining_debt_amount)}`
                          : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label className="text-sm text-gray-700">{t('pages.clientChains.notes')}</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('pages.clientChains.notesPlaceholder')}
              />
            </div>
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="flex-1">
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleSave}
          disabled={!interaction || updateMut.isPending}
          className="flex-1"
        >
          {t('actions.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
