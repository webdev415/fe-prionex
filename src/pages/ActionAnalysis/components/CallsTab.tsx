import { useTranslation } from 'react-i18next'

export function CallsTab() {
  const { t } = useTranslation('common')
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
      {t('pages.actionAnalysis.calls.placeholder', 'Calls tab — coming soon')}
    </div>
  )
}

export default CallsTab
