import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import type { OperatorUser } from '@/features/users/api/usersApi'
import { RateDialogueDialog } from '../inbox/RateDialogueDialog'

/**
 * "New assessment" entry point (KAN-504). Step 0 picks the operator, then
 * the existing RateDialogueDialog takes over: pick one of that operator's
 * recent calls → CallReviewLayout → ScorecardPanel (with the Client /
 * Third Party type selector). RateDialogueDialog is mounted only after an
 * operator is chosen so its call-monitoring query never runs until needed.
 */
export function NewAssessmentButton({ operators }: { operators: OperatorUser[] }) {
  const { t } = useTranslation('common')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [draftOperatorId, setDraftOperatorId] = useState<number | null>(null)
  const [operatorId, setOperatorId] = useState<number | null>(null)

  const openPicker = () => {
    setDraftOperatorId(null)
    setPickerOpen(true)
  }

  const handleContinue = () => {
    if (draftOperatorId == null) return
    setOperatorId(draftOperatorId)
    setPickerOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-[#BBFB5B] px-4 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#a8e848]"
      >
        <Icons.Add size={14} />
        {t('pages.training.dialogue.newAssessment', 'New assessment')}
      </button>

      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm">
        <ModalHeader
          title={t('pages.training.dialogue.newAssessmentPicker.title', 'New assessment')}
        />
        <ModalContent>
          <div className="flex flex-col gap-3 px-1 py-2">
            <label className="text-sm font-medium text-gray-700">
              {t('pages.training.dialogue.newAssessmentPicker.operator', 'Operator')}
            </label>
            <select
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={draftOperatorId ?? ''}
              onChange={(e) => setDraftOperatorId(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">
                {t('pages.training.dialogue.newAssessmentPicker.select', 'Select an operator…')}
              </option>
              {operators.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.full_name ?? `#${op.id}`}
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              size="md"
              onClick={handleContinue}
              disabled={draftOperatorId == null}
              className="self-end rounded-full"
            >
              {t('pages.training.dialogue.newAssessmentPicker.continue', 'Continue')}
            </Button>
          </div>
        </ModalContent>
      </Modal>

      {operatorId != null ? (
        <RateDialogueDialog
          open={true}
          onClose={() => setOperatorId(null)}
          operatorId={operatorId}
        />
      ) : null}
    </>
  )
}

export default NewAssessmentButton
