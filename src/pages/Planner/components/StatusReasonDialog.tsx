/**
 * «Причина*» for a status marked «потребує причини» (UX «Диалог причины»;
 * planner stories 1.10, 5.1, 5.3). One dialog for every way a status changes —
 * the status chip, a card dragged into such a column, «Перемістити в…».
 *
 * The reason is limited as the contract says (1–1000 characters after
 * trimming, counted in code points like the planner's runes). An overflow is
 * reported in the dialog, never cut off by `maxLength`. «Скасувати» and `Esc`
 * change nothing.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/lib/localeFormat'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { PLANNER_REASON_MAX, plannerTextLength } from '@/api/planner/plannerApi'

interface StatusReasonDialogProps {
  open: boolean
  /** «SKL-2 → Відхилено». */
  title: string
  onCancel: () => void
  /** The trimmed reason, within the contract's limit. */
  onConfirm: (reason: string) => void
}

export function StatusReasonDialog({ open, title, onCancel, onConfirm }: StatusReasonDialogProps) {
  const { t, i18n } = useTranslation('planner')
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | undefined>()
  // Every opening starts empty: a reason typed for one change is not offered
  // for the next.
  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setReason('')
      setReasonError(undefined)
    }
  }

  return (
    <Modal open={open} onClose={onCancel} maxWidth="sm">
      <ModalHeader title={open ? title : ''} />
      <ModalContent>
        <Textarea
          label={t('reasonDialog.label')}
          value={reason}
          error={reasonError}
          onChange={(event) => setReason(event.target.value)}
        />
      </ModalContent>
      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onCancel}>
          {t('create.cancel')}
        </Button>
        <Button
          size="sm"
          disabled={reason.trim() === ''}
          onClick={() => {
            const trimmed = reason.trim()
            if (plannerTextLength(trimmed) > PLANNER_REASON_MAX) {
              setReasonError(
                t('reasonDialog.tooLong', {
                  max: formatNumber(PLANNER_REASON_MAX, i18n.language ?? 'uk'),
                })
              )
              return
            }
            onConfirm(trimmed)
          }}
        >
          {t('reasonDialog.confirm')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export default StatusReasonDialog
