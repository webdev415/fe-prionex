import { useTranslation } from 'react-i18next'

// Step 12 (dynamics frontend, Recharts) replaces this with the operator
// score-dynamics chart. Stub renders an empty state so the sub-tab is
// navigable today.
export function DynamicsSubTab() {
  const { t } = useTranslation('common')
  return (
    <div className="rounded-xl bg-white/50 p-12 text-center text-sm text-gray-500 shadow-sm">
      {t(
        'pages.actionAnalysis.dynamicsComingSoon',
        'The operator score-dynamics chart ships in the next KAN-410 step.'
      )}
    </div>
  )
}
