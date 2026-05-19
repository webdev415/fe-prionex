import { useTranslation } from 'react-i18next'

// Step 10 (feedback frontend) replaces this with the trainer-side feedback
// inbox. Stub renders an empty state so the sub-tab is navigable today.
export function FeedbackSubTab() {
  const { t } = useTranslation('common')
  return (
    <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
      {t(
        'pages.actionAnalysis.feedbackComingSoon',
        'The feedback inbox ships in the next KAN-410 step.'
      )}
    </div>
  )
}
