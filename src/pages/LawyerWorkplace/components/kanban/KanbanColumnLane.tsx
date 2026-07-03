import { type DragEvent } from 'react'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import { cn } from '@/lib/utils'
import type { KanbanColumnDef, KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnLaneProps {
  column: KanbanColumnDef
  lawyers: LegalLawyer[]
  letterTypes: LegalLetterType[]
  draggingTaskId: string | null
  isDropTarget: boolean
  onCardClick?: (letterId: string) => void
  onMoveTask: (taskId: string, columnId: KanbanColumnId) => void
  onTaskUpdate: (taskId: string, patch: LegalKanbanTaskPatch) => void
  onDragStart: (event: DragEvent, task: KanbanTask) => void
  onDragEnd: () => void
  onDragOver: (event: DragEvent) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent) => void
}

export function KanbanColumnLane({
  column,
  lawyers,
  letterTypes,
  draggingTaskId,
  isDropTarget,
  onCardClick,
  onMoveTask,
  onTaskUpdate,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: KanbanColumnLaneProps) {
  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex min-h-0 flex-1 flex-col rounded-b-lg bg-gray-50/70 p-2 pb-4 transition-colors',
        isDropTarget && 'bg-primary-50/40 ring-primary-400 ring-2 ring-inset'
      )}
    >
      <div className="flex flex-col gap-2">
        {column.tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            lawyers={lawyers}
            letterTypes={letterTypes}
            isDragging={draggingTaskId === task.id}
            onCardClick={onCardClick}
            onMoveTask={onMoveTask}
            onTaskUpdate={onTaskUpdate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
      <div className="flex-1" aria-hidden="true" />
    </div>
  )
}
