import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { RateDialogueDialog } from '../inbox/RateDialogueDialog'

/**
 * "New assessment" entry point (KAN-504 / Scorecard Review Panel redesign).
 * Opens the RateDialogueDialog where the trainer picks the operator and one
 * of their recent calls, then Add — which creates a draft scorecard that
 * appears in the Dialogue list for review in the inline CallReviewPanel. The
 * dialog is mounted only while open so its query never runs until needed.
 */
export function NewAssessmentButton() {
  const { t } = useTranslation('common')
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-[#BBFB5B] px-4 text-xs font-medium text-[#05040D] transition-colors hover:bg-[#a8e848]"
      >
        <Icons.Add size={14} />
        {t('pages.training.dialogue.newAssessment', 'New assessment')}
      </button>

      {open ? <RateDialogueDialog open={true} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export default NewAssessmentButton
