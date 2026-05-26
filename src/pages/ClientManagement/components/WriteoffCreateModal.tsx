/**
 * Write-off Create Modal (KAN-245)
 *
 * Client-scoped modal launched from the "Write-off" button on the
 * Client detail page → Loans tab (next to "RR Connect").
 *
 * UI per ``Screenshot_1.png`` (2026-05-25 client mockup):
 * - "Choose a loan" dropdown listing the client's loans with current balance.
 * - 5 per-component sections (principal / interest / fine / penalty /
 *   commission), each with an amount input + a per-component
 *   cancellation_date picker.
 * - Read-only "Total amount written off" footer preview.
 * - Close + Save buttons.
 *
 * Per-component cancellation_date: each component carries its OWN date
 * (REQUIREMENTS §5.2). A single Save can produce N rows with N different
 * dates. Components with amount = 0 (or blank) are silently skipped — no
 * row, no error.
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { DateSelect } from '@/components/ui/DateSelect'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { formatMoneyUAHTwoDecimals } from '@/lib/formatters'
import { useCreateWriteoffs } from '@/features/writeoffs/hooks/useWriteoffs'
import {
  ACCRUAL_TYPES,
  type AccrualType,
  type CreateWriteoffRequest,
  type WriteoffFieldError,
} from '@/features/writeoffs/api/types'
import type { DebtDetail } from '@/features/clients/api/types'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteoffCreateModalProps {
  open: boolean
  onClose: () => void
  /** All loans on the client — active + non-active. Non-active are disabled in the dropdown. */
  debts: DebtDetail[]
  /** Optional preselect (e.g. when launched from a specific loan card). */
  initialDebtId?: number | null
}

interface ComponentRow {
  amount: string
  date: Date | null
  errors: string[]
}

const EMPTY_ROW: ComponentRow = { amount: '', date: null, errors: [] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseAmountToDecimal(raw: string): number | null {
  if (!raw.trim()) return null
  const normalised = raw.replace(',', '.').trim()
  const n = Number(normalised)
  if (!Number.isFinite(n)) return null
  return n
}

function isoFromDate(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getTomorrowAtMidnight(): Date {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(0, 0, 0, 0)
  return t
}

// Map the backend's stable error codes to user-facing i18n keys.
const ERROR_CODE_I18N: Record<string, string> = {
  CANCELLATION_DATE_IN_PAST: 'pages.clients.detail.writeOffModal.errors.cancellationDateInPast',
  AMOUNT_MUST_BE_POSITIVE: 'pages.clients.detail.writeOffModal.errors.amountMustBePositive',
  NO_COMPONENTS_TO_WRITE_OFF: 'pages.clients.detail.writeOffModal.errors.noComponentsToWriteOff',
  DEBT_NOT_FOUND: 'pages.clients.detail.writeOffModal.errors.debtNotFound',
  DEBT_NOT_OPEN: 'pages.clients.detail.writeOffModal.errors.debtNotOpen',
  INSUFFICIENT_BALANCE: 'pages.clients.detail.writeOffModal.errors.insufficientBalance',
  PERMISSION_DENIED: 'pages.clients.detail.writeOffModal.errors.permissionDenied',
  FEATURE_DISABLED: 'pages.clients.detail.writeOffModal.errors.featureDisabled',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WriteoffCreateModal({
  open,
  onClose,
  debts,
  initialDebtId = null,
}: WriteoffCreateModalProps) {
  const { t } = useTranslation('common')

  // ------------------------------------------------------------------
  // Picked loan
  // ------------------------------------------------------------------

  const selectableDebts = useMemo(() => debts.filter((d) => d.status === 'active'), [debts])

  const [selectedDebtId, setSelectedDebtId] = useState<number | null>(
    initialDebtId ?? selectableDebts[0]?.id ?? null
  )

  // Re-seed the dropdown when the modal opens or eligible debts change.
  // Allowed `set-state-in-effect` — the seed depends on the `open` +
  // `initialDebtId` + `selectableDebts` inputs and has no external
  // system to subscribe to.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return
    if (initialDebtId && selectableDebts.some((d) => d.id === initialDebtId)) {
      setSelectedDebtId(initialDebtId)
    } else if (!selectedDebtId && selectableDebts[0]) {
      setSelectedDebtId(selectableDebts[0].id)
    }
  }, [open, initialDebtId, selectableDebts, selectedDebtId])
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedDebt = useMemo(
    () => debts.find((d) => d.id === selectedDebtId) ?? null,
    [debts, selectedDebtId]
  )

  // ------------------------------------------------------------------
  // Component form state
  // ------------------------------------------------------------------

  const [rows, setRows] = useState<Record<AccrualType, ComponentRow>>({
    principal: { ...EMPTY_ROW },
    interest: { ...EMPTY_ROW },
    penalty: { ...EMPTY_ROW },
    fine: { ...EMPTY_ROW },
    commission: { ...EMPTY_ROW },
  })
  const [notes, setNotes] = useState<string>('')
  const [topLevelError, setTopLevelError] = useState<string | null>(null)

  const resetForm = () => {
    setRows({
      principal: { ...EMPTY_ROW },
      interest: { ...EMPTY_ROW },
      penalty: { ...EMPTY_ROW },
      fine: { ...EMPTY_ROW },
      commission: { ...EMPTY_ROW },
    })
    setNotes('')
    setTopLevelError(null)
  }

  // Reset on close. Allowed `set-state-in-effect` — there is no
  // external system to sync; the form simply needs to clear when the
  // modal closes so a subsequent open starts fresh.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) resetForm()
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateRow = (accrual: AccrualType, patch: Partial<ComponentRow>) => {
    setRows((r) => ({ ...r, [accrual]: { ...r[accrual], ...patch, errors: [] } }))
    setTopLevelError(null)
  }

  // ------------------------------------------------------------------
  // Totals + validation surface
  // ------------------------------------------------------------------

  const totalAmount = useMemo(() => {
    let sum = 0
    for (const t of ACCRUAL_TYPES) {
      const n = parseAmountToDecimal(rows[t].amount)
      if (n !== null && n > 0) sum += n
    }
    return sum
  }, [rows])

  const hasAnyPositiveAmount = totalAmount > 0

  // Per-component balance preview from the selected debt's amounts.
  // Best-effort: the live ``available_balance(c)`` requires the backend
  // aggregator. Here we surface the static debt baseline so the operator
  // sees an order-of-magnitude hint; the real check happens on submit.
  const getStaticBalanceHint = (accrual: AccrualType): number | null => {
    if (!selectedDebt) return null
    const colMap: Record<AccrualType, keyof DebtDetail> = {
      principal: 'principal_amount',
      interest: 'interest_amount',
      penalty: 'penalties_amount',
      fine: 'fines_amount',
      commission: 'fees_amount',
    }
    const raw = (selectedDebt as unknown as Record<string, unknown>)[colMap[accrual] as string]
    if (raw == null) return null
    const n = typeof raw === 'string' ? Number(raw) : (raw as number)
    return Number.isFinite(n) ? n : null
  }

  // ------------------------------------------------------------------
  // Backend error wiring
  // ------------------------------------------------------------------

  const handleValidationErrors = (errors: WriteoffFieldError[]) => {
    let unmatched = false
    setRows((r) => {
      const next = { ...r }
      for (const e of errors) {
        // Try to extract the accrual_type from the field path
        // (e.g. "components.interest.amount" or "components.fine.cancellation_date")
        const m = (e.field ?? '').match(/components\.(principal|interest|penalty|fine|commission)/)
        if (m) {
          const accrual = m[1] as AccrualType
          const i18nKey = ERROR_CODE_I18N[e.code]
          const text = i18nKey ? t(i18nKey, e as Record<string, unknown>) : (e.code as string)
          next[accrual] = {
            ...next[accrual],
            errors: [...next[accrual].errors, text],
          }
        } else {
          unmatched = true
        }
      }
      return next
    })
    if (unmatched) {
      // Surface non-component-scoped errors at the top of the modal
      const summaries = errors
        .filter((e) => !(e.field ?? '').includes('components.'))
        .map((e) => {
          const key = ERROR_CODE_I18N[e.code]
          return key ? t(key, e as Record<string, unknown>) : e.code
        })
      if (summaries.length) setTopLevelError(summaries.join(' • '))
    }
  }

  const { mutate, isPending } = useCreateWriteoffs(selectedDebtId ?? 0, {
    onValidationErrors: handleValidationErrors,
  })

  // ------------------------------------------------------------------
  // Submit
  // ------------------------------------------------------------------

  const buildRequest = (): CreateWriteoffRequest | null => {
    const components: CreateWriteoffRequest['components'] = {}
    for (const accrual of ACCRUAL_TYPES) {
      const row = rows[accrual]
      const n = parseAmountToDecimal(row.amount)
      if (n === null || n === 0) continue
      components[accrual] = {
        amount: String(n),
        cancellation_date: isoFromDate(row.date),
      }
    }
    if (Object.keys(components).length === 0) return null
    return { components, notes: notes.trim() || null }
  }

  const canSubmit = !!selectedDebt && hasAnyPositiveAmount && !isPending

  const handleSave = () => {
    if (!selectedDebt) return
    const body = buildRequest()
    if (!body) {
      setTopLevelError(t('pages.clients.detail.writeOffModal.errors.noComponentsToWriteOff'))
      return
    }
    mutate(body, {
      onSuccess: () => {
        toast.success(t('pages.clients.detail.writeOffModal.saveSuccess'))
        onClose()
      },
    })
  }

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  const tomorrow = getTomorrowAtMidnight()

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={<Icons.MoneyRemove01 size={24} />}
        title={t('pages.clients.detail.writeOffModal.title')}
      />
      <ModalContent>
        <div className="flex flex-col gap-6">
          {/* Loan picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t('pages.clients.detail.writeOffModal.chooseALoan')}
            </label>
            <Select
              value={selectedDebtId ? String(selectedDebtId) : undefined}
              onValueChange={(v) => setSelectedDebtId(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={t('pages.clients.detail.writeOffModal.chooseALoanPlaceholder')}
                />
              </SelectTrigger>
              <SelectContent>
                {debts.map((d) => {
                  const remaining = Number(d.remaining_debt_amount ?? 0)
                  const label = `${d.contract_number ?? `#${d.id}`} — ${formatMoneyUAHTwoDecimals(remaining)}`
                  return (
                    <SelectItem key={d.id} value={String(d.id)} disabled={d.status !== 'active'}>
                      {label}
                      {d.status !== 'active' && (
                        <span className="ml-2 text-xs text-gray-500">({d.status})</span>
                      )}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            {selectableDebts.length === 0 && (
              <p className="text-error-500 text-sm">
                {t('pages.clients.detail.writeOffModal.noActiveLoans')}
              </p>
            )}
          </div>

          {/* Per-component rows */}
          <div className="flex flex-col gap-4">
            {ACCRUAL_TYPES.map((accrual) => {
              const row = rows[accrual]
              const hint = getStaticBalanceHint(accrual)
              return (
                <div
                  key={accrual}
                  className="flex flex-col gap-3 rounded border border-gray-200 p-3 md:p-4"
                >
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                    <Input
                      label={t(`pages.clients.detail.writeOffModal.components.${accrual}`)}
                      placeholder={t('pages.clients.detail.writeOffModal.amountPlaceholder')}
                      type="text"
                      inputMode="decimal"
                      value={row.amount}
                      onChange={(e) => updateRow(accrual, { amount: e.target.value })}
                      helperText={
                        hint !== null && hint > 0
                          ? t('pages.clients.detail.writeOffModal.balanceHint', {
                              amount: formatMoneyUAHTwoDecimals(hint),
                            })
                          : undefined
                      }
                    />
                    <DateSelect
                      label={t('pages.clients.detail.writeOffModal.cancellationDate')}
                      placeholder={t(
                        'pages.clients.detail.writeOffModal.cancellationDatePlaceholder'
                      )}
                      value={row.date}
                      onChange={({ value }) => updateRow(accrual, { date: value })}
                      min={tomorrow}
                    />
                  </div>
                  {row.errors.length > 0 && (
                    <ul className="text-error-500 list-disc pl-5 text-sm">
                      {row.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">
              {t('pages.clients.detail.writeOffModal.notes')}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={1000}
              placeholder={t('pages.clients.detail.writeOffModal.notesPlaceholder')}
            />
          </div>

          {/* Top-level error band */}
          {topLevelError && <p className="text-error-500 text-sm">{topLevelError}</p>}

          {/* Total amount written off */}
          <div className="flex items-center justify-between border-t border-gray-200 pt-4">
            <span className="text-sm font-medium text-gray-700">
              {t('pages.clients.detail.writeOffModal.totalAmount')}
            </span>
            <span className="text-dark-500 text-base font-semibold">
              {formatMoneyUAHTwoDecimals(totalAmount)}
            </span>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} disabled={isPending}>
          {t('common.close')}
        </Button>
        <Button variant="primary" onClick={handleSave} disabled={!canSubmit} isLoading={isPending}>
          {t('common.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
