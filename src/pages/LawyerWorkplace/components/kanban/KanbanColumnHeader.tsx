import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { KanbanColumnDef } from '../../kanban/kanbanData'

interface KanbanColumnHeaderProps {
  column: KanbanColumnDef
}

export function KanbanColumnHeader({ column }: KanbanColumnHeaderProps) {
  const { t } = useTranslation('common')
  const label = t(column.labelKey, column.id.replace('_', ' ').toUpperCase())
  const count = column.tasks.length

  return (
    <div className="border-light-100 flex items-center gap-2 rounded-t-lg border-b bg-white px-4 py-3 shadow-sm">
      <span className={cn('h-2 w-2 shrink-0 rounded-full', column.dotClass)} />
      <span className="text-[11px] font-semibold tracking-widest text-gray-500 uppercase">
        {label}
      </span>
      <span className="ml-auto rounded-full bg-gray-100 px-2 py-0.5 text-[10.5px] font-medium text-gray-600">
        {column.todayCount != null
          ? `${count} · ${t('pages.lawyerWorkplace.kanban.today', 'today')}`
          : count}
      </span>
    </div>
  )
}
