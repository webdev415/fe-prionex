import { type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { KanbanColumnDef, KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnLaneProps {
  column: KanbanColumnDef
  draggingTaskId: string | null
  isDropTarget: boolean
  onCardClick?: (letterId: string) => void
  onMoveTask: (taskId: string, columnId: KanbanColumnId) => void
  onDragStart: (event: DragEvent, task: KanbanTask) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent) => void
}

export function KanbanColumnLane({
  column,
  draggingTaskId,
  isDropTarget,
  onCardClick,
  onMoveTask,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: KanbanColumnLaneProps) {
  const { t } = useTranslation('common')

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex h-full flex-col rounded-b-lg bg-gray-50/70 p-2 pb-4 transition-colors',
        isDropTarget && 'bg-primary-50/40 ring-primary-400 ring-2 ring-inset'
      )}
    >
      <div className="flex flex-col gap-2">
        {column.tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            isDragging={draggingTaskId === task.id}
            onCardClick={onCardClick}
            onMoveTask={onMoveTask}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
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
