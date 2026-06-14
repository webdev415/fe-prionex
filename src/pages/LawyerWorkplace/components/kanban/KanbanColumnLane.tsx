import { useTranslation } from 'react-i18next'
import type { KanbanColumnDef } from '../../kanban/kanbanData'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnLaneProps {
  column: KanbanColumnDef
  onCardClick?: (letterId: string) => void
}

export function KanbanColumnLane({ column, onCardClick }: KanbanColumnLaneProps) {
  const { t } = useTranslation('common')

  return (
    <div className="flex h-full flex-col rounded-b-lg bg-gray-50/70 p-2 pb-4">
      <div className="flex flex-col gap-2">
        {column.tasks.map((task) => (
          <KanbanCard key={task.id} task={task} onCardClick={onCardClick} />
        ))}
        {column.tasks.length === 0 && (
          <p className="py-8 text-center text-[12px] text-gray-400">
            {t('pages.lawyerWorkplace.kanban.emptyColumn', 'No tasks')}
          </p>
        )}
      </div>
      <div className="min-h-[50vh] flex-1" aria-hidden="true" />
    </div>
  )
}
