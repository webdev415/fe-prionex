import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { DateSelect } from '@/components/ui/DateSelect'
import '@/components/ui/DateSelect.theme.css'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { recordTermination } from '@/features/employeeCard/api/employeeCardApi'
import { employeeCardKeys } from '@/features/employeeCard/hooks/useEmployeeCard'
import { employeeEventKeys } from '@/features/employeeCard/hooks/useEmployeeEvents'
import {
  TERMINATION_REASONS,
  type EmployeeCard,
  type TerminationReason,
} from '@/features/employeeCard/types.card'
import { formatPickerDateAsYMD, parsePickerYMD } from '@/lib/dateUtils'
import { getErrorMessage } from '@/lib/errors'

export interface TerminationDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-termination'

/** What the service stores. Longer than this is refused with a 422. */
const COMMENT_LIMIT = 2000

/**
 * Recording that somebody has left, or correcting what was recorded.
 *
 * Reinstating is the panel's job, not this dialog's. It lived here once,
 * below the fields, where nobody looking for it would think to go - and a
 * dialog whose submit reads "Terminate" is the wrong place to keep the one
 * control that undoes exactly that.
 */
export function TerminationDialog({ card, projectId, open, onClose }: TerminationDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const employeeId = card.header.id
  const existing = card.termination

  const [terminatedOn, setTerminatedOn] = useState(existing?.terminated_on ?? '')
  const [reason, setReason] = useState<TerminationReason>(
    (existing?.reason as TerminationReason) ?? 'personal_desire'
  )
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (work: () => Promise<EmployeeCard>) => {
    setBusy(true)
    setError(null)
    try {
      const saved = await work()
      queryClient.setQueryData(employeeCardKeys.one(employeeId, projectId), saved)
      // The departure is a line in the history, and the history is its own
      // query - it would otherwise keep the old ending until a reload.
      await queryClient.invalidateQueries({ queryKey: employeeEventKeys.all })
      onClose()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader title={t('pages.employeeCard.dialogs.termination')} />
      <ModalContent>
        <p className="text-muted-foreground mb-4 text-sm">
          {t('pages.employeeCard.termination.hint')}
        </p>

        {error && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            {error}
          </p>
        )}

        <form
          id={FORM_ID}
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            void run(() =>
              recordTermination(employeeId, {
                terminated_on: terminatedOn,
                reason,
                comment: comment.trim() || null,
              })
            )
          }}
        >
          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs">
              {t('pages.employeeCard.termination.date')}
            </span>
            <DateSelect
              value={parsePickerYMD(terminatedOn)}
              onChange={({ value }) => setTerminatedOn(value ? formatPickerDateAsYMD(value) : '')}
              format="dd.MM.yyyy"
              allowManualInput
              placeholder={t('pages.employeeCard.termination.date')}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-muted-foreground text-xs">
              {t('pages.employeeCard.termination.reason')}
            </span>
            <Select value={reason} onValueChange={(value) => setReason(value as TerminationReason)}>
              <SelectTrigger aria-label={t('pages.employeeCard.termination.reason')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TERMINATION_REASONS.map((one) => (
                  <SelectItem key={one} value={one}>
                    {t(`pages.employeeCard.termination.reasons.${one}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/*
            Bounded to what the service accepts. Without it a longer comment is
            typed, submitted, and refused with a 422 the reader has no way to
            have predicted.
          */}
          <Input
            label={t('pages.employeeCard.termination.comment')}
            value={comment}
            maxLength={COMMENT_LIMIT}
            disabled={busy}
            onChange={(event) => setComment(event.target.value)}
            className="sm:col-span-2"
          />
        </form>
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="cancel"
          onClick={onClose}
          disabled={busy}
          className="h-[45px] flex-1 text-sm"
        >
          {t('actions.cancel')}
        </Button>
        {/*
          Named for the act, not for the mechanism. "Save" is what you press
          after changing a field; this closes somebody's card and puts a
          departure in their history, and the submit is the last chance to
          notice that is what is about to happen. Correcting one already
          recorded really is a save, and says so.
        */}
        <Button
          type="submit"
          form={FORM_ID}
          variant={existing ? 'primary' : 'danger'}
          disabled={busy || !terminatedOn}
          className="h-[45px] flex-1 text-sm"
        >
          {existing ? t('actions.save') : t('pages.employeeCard.termination.terminate')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
