/**
 * Tags Management Page
 *
 * Page for managing tags used throughout the system.
 */

import { useTranslation } from 'react-i18next'

export function TagsPage() {
  const { t } = useTranslation('common')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-dark-500 text-2xl font-light">{t('pages.tags.title', 'Tags')}</h1>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-gray-500">
          {t('pages.tags.comingSoon', 'Tags management coming soon...')}
        </p>
      </div>
    </div>
  )
}

export default TagsPage
