/**
 * Edit dialog for an active write-off entry (KAN-245).
 *
 * Per AC-7: only ``cancellation_date`` (strictly future) and ``notes``
 * are editable. The backend rejects ``amount`` / ``accrual_type`` at
 * the schema layer (model_config extra='forbid'), mapped to
 * WRITEOFF_AMOUNT_IMMUTABLE / WRITEOFF_ACCRUAL_TYPE_IMMUTABLE.
 *
 * This dialog never sends those fields, so we don't render inputs for them.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import { Textarea } from '@/components/ui/Textarea'
import { Icons } from '@/lib/icons'
import { useEditWriteoff } from '@/features/writeoffs/hooks/useWriteoffs'
import type { WriteoffEntry, WriteoffFieldError } from '@/features/writeoffs/api/types'

export interface WriteoffEditDialogProps {
  open: boolean
  onClose: () => void
  entry: WriteoffEntry
}

function getTomorrowAtMidnight(): Date {
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(0, 0, 0, 0)
  return t
}

function isoFromDate(d: Date | null): string | null {
  if (!d) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function WriteoffEditDialog({ open, onClose, entry }: WriteoffEditDialogProps) {
  const { t } = useTranslation('common')

  const initialDate = entry.cancellation_date ? new Date(entry.cancellation_date) : null

  const [date, setDate] = useState<Date | null>(initialDate)
  const [notes, setNotes] = useState<string>(entry.notes ?? '')
  const [errors, setErrors] = useState<string[]>([])

  // Reset state when (re-)opened against a possibly different entry.
  // Allowed `set-state-in-effect` — we are syncing to the ``entry``
  // input prop; there is no external system to subscribe to here.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (open) {
      setDate(entry.cancellation_date ? new Date(entry.cancellation_date) : null)
      setNotes(entry.notes ?? '')
      setErrors([])
    }
  }, [open, entry.id, entry.cancellation_date, entry.notes])
  /* eslint-enable react-hooks/set-state-in-effect */

  const { mutate, isPending } = useEditWriteoff(entry.id, {
    onValidationErrors: (errs: WriteoffFieldError[]) => {
      setErrors(
        errs.map((e) =>
          t(`pages.clients.detail.writeOffModal.errors.${e.code.toLowerCase()}`, {
            defaultValue: e.code,
            ...e,
          })
        )
      )
    },
  })

  const handleSave = () => {
    const body: { cancellation_date?: string; notes?: string } = {}
    const isoDate = isoFromDate(date)
    if (isoDate && isoDate !== entry.cancellation_date) {
      body.cancellation_date = isoDate
    }
    if (notes !== (entry.notes ?? '')) {
      body.notes = notes
    }
    if (Object.keys(body).length === 0) {
      onClose()
      return
    }
    mutate(body, {
      onSuccess: () => {
        toast.success(t('pages.clients.detail.writeOffEditDialog.saveSuccess'))
        onClose()
      },
    })
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="md">
      <ModalHeader
        icon={
          <div className="bg-primary flex h-10 w-10 items-center justify-center rounded-full sm:h-12 sm:w-12">
            <Icons.PencilEdit02
              size={20}
              className="text-primary-foreground sm:size-6"
              strokeWidth={1.5}
            />
          </div>
        }
        title={t('pages.clients.detail.writeOffEditDialog.title')}
      />
      <ModalContent>
        <div className="flex flex-col gap-4">
          <p className="text-muted-foreground text-xs">
            {t('pages.clients.detail.writeOffEditDialog.immutabilityNote')}
          </p>
          <DateSelect
            label={t('pages.clients.detail.writeOffModal.cancellationDate')}
            value={date}
            onChange={({ value }) => setDate(value)}
            min={getTomorrowAtMidnight()}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-foreground text-sm font-medium">
              {t('pages.clients.detail.writeOffModal.notes')}
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              rows={3}
            />
          </div>
          {errors.length > 0 && (
            <ul className="text-error-500 list-disc pl-5 text-sm">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          )}
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} disabled={isPending}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleSave} isLoading={isPending}>
          {t('common.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
