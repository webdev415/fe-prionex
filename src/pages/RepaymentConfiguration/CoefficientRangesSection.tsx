/**
 * Coefficient ranges — Settings section (KAN-994 Phase A).
 *
 * Admin-configured day-range groups feeding the Loans tab Principal Debt
 * tooltip. No mockup exists for this screen, so it follows the list/table CRUD
 * shape used elsewhere in Settings.
 *
 * Coefficients are held as strings end to end: the column is numeric(3,1) and
 * the API rejects more than one decimal place, so parsing to a JS float and
 * back would risk sending 1.5000000000000002 for a value the user typed as 1.5.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { useHasPermission } from '@/hooks'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useCreateCoefficientRange,
  useDeleteCoefficientRange,
  useLoanCoefficientRanges,
  useUpdateCoefficientRange,
} from '@/features/loanCoefficientRanges/hooks/useLoanCoefficientRanges'
import type { LoanCoefficientRange } from '@/features/loanCoefficientRanges/api/loanCoefficientRangesApi'
import { validateRange, type RangeFormState } from './coefficientRangeValidation'

const EMPTY_FORM: RangeFormState = {
  min_days: '',
  max_days: '',
  min_coefficient: '',
  max_coefficient: '',
}

/** Same rendering as RepaymentConfigurationPage's formatDate. Kept local
 *  rather than exported from that page component — a sibling section should
 *  not import from a page module just to reuse a one-liner. */
function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}

export function CoefficientRangesSection() {
  const { t } = useTranslation()
  const canEdit = useHasPermission(PERMISSIONS.SYSTEM.MANAGE_SETTINGS)

  const { data: ranges = [], isLoading, isError } = useLoanCoefficientRanges()
  const createMutation = useCreateCoefficientRange()
  const updateMutation = useUpdateCoefficientRange()
  const deleteMutation = useDeleteCoefficientRange()

  const [editing, setEditing] = useState<LoanCoefficientRange | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [form, setForm] = useState<RangeFormState>(EMPTY_FORM)
  const [pendingDelete, setPendingDelete] = useState<LoanCoefficientRange | null>(null)

  const isSaving = createMutation.isPending || updateMutation.isPending

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setIsFormOpen(true)
  }

  const openEdit = (range: LoanCoefficientRange) => {
    setEditing(range)
    setForm({
      min_days: String(range.min_days),
      max_days: String(range.max_days),
      min_coefficient: range.min_coefficient,
      max_coefficient: range.max_coefficient,
    })
    setIsFormOpen(true)
  }

  const handleSubmit = () => {
    const error = validateRange(form, t)
    if (error) {
      toast.error(error)
      return
    }

    const input = {
      min_days: Number(form.min_days),
      max_days: Number(form.max_days),
      min_coefficient: form.min_coefficient,
      max_coefficient: form.max_coefficient,
    }

    // The overlap rule is enforced by a database constraint, so a 400 here is
    // expected traffic, not an exception: surface the server's message, which
    // names the range that clashed.
    const onError = (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
      toast.error(
        typeof detail === 'string'
          ? detail
          : t('pages.coefficientRanges.saveError', 'Could not save the range')
      )
    }

    if (editing) {
      updateMutation.mutate(
        { id: editing.id, input },
        {
          onSuccess: () => {
            toast.success(t('pages.coefficientRanges.updated', 'Range updated'))
            setIsFormOpen(false)
          },
          onError,
        }
      )
    } else {
      createMutation.mutate(input, {
        onSuccess: () => {
          toast.success(t('pages.coefficientRanges.created', 'Range added'))
          setIsFormOpen(false)
        },
        onError,
      })
    }
  }

  const handleDelete = () => {
    if (!pendingDelete) return
    deleteMutation.mutate(pendingDelete.id, {
      onSuccess: () => {
        toast.success(t('pages.coefficientRanges.deleted', 'Range deleted'))
        setPendingDelete(null)
      },
      onError: () => toast.error(t('pages.coefficientRanges.deleteError', 'Could not delete')),
    })
  }

  const setField = (key: keyof RangeFormState) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <section className="border-border bg-card w-full rounded-2xl border p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-foreground text-base font-semibold">
            {t('pages.coefficientRanges.title', 'Coefficient ranges')}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {t(
              'pages.coefficientRanges.description',
              'Loan closing coefficients by loan age. Ranges are inclusive on both ends and may not overlap.'
            )}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="primary"
            onClick={openCreate}
            className="flex h-10 shrink-0 items-center justify-center rounded-full text-xs font-medium"
          >
            {t('pages.coefficientRanges.add', 'Add range')}
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">{t('common.loading', 'Loading...')}</p>
      ) : isError ? (
        // Distinct from the empty state: a failed load rendering "No ranges
        // configured" tells the admin something false, and they would go on to
        // add a range that may already exist.
        <p className="text-error-600 text-sm">
          {t('pages.coefficientRanges.loadError', 'Could not load the coefficient ranges.')}
        </p>
      ) : ranges.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.coefficientRanges.empty',
            'No ranges configured. The coefficient tooltip stays hidden until one matches.'
          )}
        </p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-muted-foreground border-border border-b text-left text-xs">
                <th className="py-2 pr-4 font-medium">
                  {t('pages.coefficientRanges.daysColumn', 'Loan age (days)')}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t('pages.coefficientRanges.coefficientColumn', 'Coefficient')}
                </th>
                <th className="py-2 pr-4 font-medium">
                  {t('pages.coefficientRanges.updatedByColumn', 'Updated by')}
                </th>
                {canEdit && <th className="py-2 font-medium" />}
              </tr>
            </thead>
            <tbody>
              {ranges.map((range) => (
                <tr key={range.id} className="border-border/60 border-b last:border-0">
                  <td className="text-foreground py-3 pr-4 whitespace-nowrap">
                    {range.min_days} – {range.max_days}
                  </td>
                  <td className="text-foreground py-3 pr-4 whitespace-nowrap">
                    ×{range.min_coefficient}–{range.max_coefficient}
                  </td>
                  <td className="text-muted-foreground py-3 pr-4">
                    <div className="flex flex-col">
                      <span>{range.updated_by_username ?? '—'}</span>
                      <span className="text-xs">{formatDate(range.updated_at)}</span>
                    </div>
                  </td>
                  {canEdit && (
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="white-secondary"
                          onClick={() => openEdit(range)}
                          className="h-8 rounded-full px-3 text-xs"
                        >
                          {t('common.edit', 'Edit')}
                        </Button>
                        <Button
                          variant="white-secondary"
                          onClick={() => setPendingDelete(range)}
                          className="h-8 rounded-full px-3 text-xs"
                        >
                          {t('common.delete', 'Delete')}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Names the permission rather than saying "view-only": this section is
          gated on manage_settings while the rest of the page is gated on
          edit_repayment_config, so a user can legitimately edit the repayment
          rules above and not these ranges. A generic banner reads as a
          contradiction on that screen. */}
      {!canEdit && (
        <div className="border-warning-200 bg-warning-100/40 text-warning-700 mt-4 flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-sm">
          <div className="bg-warning-100 text-warning-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
            <Icons.Warning size={16} strokeWidth={2} />
          </div>
          <div className="min-w-0 self-center">
            {t(
              'pages.coefficientRanges.readOnly',
              'Editing coefficient ranges requires the Manage settings permission. The rest of this page follows its own permission.'
            )}
          </div>
        </div>
      )}

      <Modal open={isFormOpen} onClose={() => setIsFormOpen(false)}>
        <ModalHeader
          title={
            editing
              ? t('pages.coefficientRanges.editTitle', 'Edit range')
              : t('pages.coefficientRanges.addTitle', 'Add range')
          }
        />
        <ModalContent className="max-w-md">
          <div className="flex flex-col gap-4 px-6 py-2">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs">
                {t('pages.coefficientRanges.minDays', 'Min days')}
                <Input
                  type="number"
                  min={0}
                  value={form.min_days}
                  onChange={setField('min_days')}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                {t('pages.coefficientRanges.maxDays', 'Max days')}
                <Input
                  type="number"
                  min={0}
                  value={form.max_days}
                  onChange={setField('max_days')}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                {t('pages.coefficientRanges.minCoefficient', 'Min coefficient')}
                <Input
                  type="number"
                  step="0.1"
                  min={1}
                  max={10}
                  value={form.min_coefficient}
                  onChange={setField('min_coefficient')}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs">
                {t('pages.coefficientRanges.maxCoefficient', 'Max coefficient')}
                <Input
                  type="number"
                  step="0.1"
                  min={1}
                  max={10}
                  value={form.max_coefficient}
                  onChange={setField('max_coefficient')}
                />
              </label>
            </div>
            <p className="text-muted-foreground text-xs">
              {t(
                'pages.coefficientRanges.hint',
                'Both day boundaries are inclusive. Coefficients take one decimal place, 1.0 to 10.0.'
              )}
            </p>
          </div>
          <ModalFooter>
            <Button
              variant="white-secondary"
              onClick={() => setIsFormOpen(false)}
              disabled={isSaving}
              className="h-10 rounded-full text-xs"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              isLoading={isSaving}
              disabled={isSaving}
              className="h-10 rounded-full text-xs"
            >
              {t('common.save', 'Save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal open={pendingDelete !== null} onClose={() => setPendingDelete(null)}>
        <ModalHeader title={t('pages.coefficientRanges.deleteTitle', 'Delete range')} />
        <ModalContent className="max-w-sm">
          <div className="text-sm">
            {t('pages.coefficientRanges.deleteConfirm', 'Delete the range {{range}}?', {
              range: pendingDelete ? `${pendingDelete.min_days}–${pendingDelete.max_days}` : '',
            })}
          </div>
          <ModalFooter>
            <Button
              variant="white-secondary"
              onClick={() => setPendingDelete(null)}
              className="h-10 rounded-full text-xs"
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleDelete}
              isLoading={deleteMutation.isPending}
              className="h-10 rounded-full text-xs"
            >
              {t('common.delete', 'Delete')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </section>
  )
}
