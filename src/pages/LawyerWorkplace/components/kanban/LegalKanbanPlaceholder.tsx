import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'

export function LegalKanbanPlaceholder() {
  const { t } = useTranslation('common')

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-white p-12">
      <Icons.Briefcase01 size={40} strokeWidth={1.5} className="text-gray-300" />
      <h3 className="text-dark-500 text-lg font-medium">
        {t('pages.lawyerWorkplace.kanban.title', 'Legal tasks kanban')}
      </h3>
      <p className="max-w-md text-center text-sm text-gray-500">
        {t(
          'pages.lawyerWorkplace.kanban.comingSoon',
          'Kanban board for legal department tasks — coming in KAN-526.'
        )}
      </p>
    </div>
  )
}
