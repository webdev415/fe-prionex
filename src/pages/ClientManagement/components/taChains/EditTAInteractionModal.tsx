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
  useTAInteraction,
  useUpdateTAInteraction,
} from '@/features/taInteractions/hooks/useTAInteractions'
import { useTAChain } from '@/features/taChains/hooks/useTAChains'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import { useClientPhones } from '@/features/clients/hooks/useClientPhones'
import type { ContactSource } from '@/features/taChains/api/types'
import { getErrorMessage } from '@/lib/errors'
import { formatMoneyKopeckTight } from '@/lib/formatters'

function ContactStepEdit({
  clientId,
  source,
  value,
  onChange,
}: {
  clientId: number
  source: ContactSource | null
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation('common')
  const { data: phonesData } = useClientPhones(clientId, source)
  if (!source) {
    return (
      <span className="text-xs text-gray-500">
        {t('pages.clientChains.contactNoSource', 'No contact source configured')}
      </span>
    )
  }
  // step_data stores the phone string verbatim, so the Select compares
  // by contact_value not id. If the saved value isn't in the current
  // phone list (contact deleted/renamed), still show it as a stale entry.
  const phones = phonesData ?? []
  const valueIsKnown = phones.some((p) => p.contact_value === value)
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
        {phones.map((p) => (
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

interface Props {
  open: boolean
  interactionId: number | null
  onClose: () => void
  onSaved?: () => void
  debts?: Array<{
    id: number
    contract_number?: string
    remaining_debt_amount?: string | number | null
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

  const { data: interaction } = useTAInteraction(open ? interactionId : null)
  const { data: chain } = useTAChain(interaction?.chain_id ?? null)
  const { data: tasData } = useTargetActions({ include_hidden: true })
  const taById = useMemo(() => {
    const m = new Map<number, NonNullable<typeof tasData>['items'][number]>()
    for (const ta of tasData?.items ?? []) m.set(ta.id, ta)
    return m
  }, [tasData])

  const updateMut = useUpdateTAInteraction()

  // Local form state — keyed by target_action_id (string) to match step_data shape.
  const [seenInteractionId, setSeenInteractionId] = useState<number | null>(null)
  const [stepValues, setStepValues] = useState<Record<string, string>>({})
  const [promiseDate, setPromiseDate] = useState<string>('')
  const [promiseAmount, setPromiseAmount] = useState<string>('')
  const [creditId, setCreditId] = useState<string>('')
  const [notes, setNotes] = useState<string>('')

  // Hydrate from loaded interaction (setState during render — avoids effect cascade)
  if (interaction && interaction.id !== seenInteractionId) {
    setSeenInteractionId(interaction.id)
    setStepValues(
      Object.fromEntries(
        Object.entries(interaction.step_data ?? {}).map(([k, v]) => [k, String(v ?? '')])
      )
    )
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
    const trimmedNotes = notes.trim()
    const cleanedStepData = Object.fromEntries(
      Object.entries(stepValues).filter(([, v]) => v !== '')
    )

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
      toast.success(t('pages.clientChains.editInteraction.savedToast', 'Interaction updated'))
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const setStepValue = (taId: number, v: string) =>
    setStepValues((prev) => ({ ...prev, [String(taId)]: v }))

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-7 w-7 items-center justify-center rounded-full">
            <Icons.PencilEdit size={18} className="text-dark-500" strokeWidth={2} />
          </div>
        }
        title={t('pages.clientChains.editInteraction.title', 'Edit interaction')}
      />
      <ModalContent>
        {!interaction || !chain ? (
          <div className="text-sm text-gray-500">{t('common.loading')}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {t('pages.clientChains.editInteraction.chainLabel', 'Chain')}:{' '}
              <span className="font-medium text-gray-800">{chain.name}</span>
            </div>

            {orderedSteps.map((step) => {
              const ta = taById.get(step.target_action_id)
              const value = stepValues[String(step.target_action_id)] ?? ''
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
                    <Select
                      value={value}
                      onValueChange={(v) => setStepValue(step.target_action_id, v)}
                    >
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
                    <Input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => setStepValue(step.target_action_id, e.target.value)}
                    />
                  ) : ta.field_type === 'amount' ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      leftIcon={<span className="text-gray-700">₴</span>}
                      value={value}
                      onChange={(e) => setStepValue(step.target_action_id, e.target.value)}
                    />
                  ) : ta.field_type === 'contact' ? (
                    <ContactStepEdit
                      clientId={interaction.client_id}
                      source={step.contact_source}
                      value={value}
                      onChange={(v) => setStepValue(step.target_action_id, v)}
                    />
                  ) : (
                    <Input
                      type="text"
                      placeholder={ta.name}
                      value={value}
                      onChange={(e) => setStepValue(step.target_action_id, e.target.value)}
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
