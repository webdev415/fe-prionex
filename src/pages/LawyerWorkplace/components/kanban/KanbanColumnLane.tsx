import { type DragEvent } from 'react'
import type { LegalKanbanTaskPatch, LegalLawyer, LegalLetterType } from '@/features/lawyerWorkplace'
import { cn } from '@/lib/utils'
import type { KanbanColumnDef, KanbanColumnId, KanbanTask } from '../../kanban/kanbanData'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnLaneProps {
  column: KanbanColumnDef
  lawyers: LegalLawyer[]
  letterTypes: LegalLetterType[]
  editableLetterTypes: LegalLetterType[]
  draggingTaskId: string | null
  isDropTarget: boolean
  onCardClick?: (task: KanbanTask) => void
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
  editableLetterTypes,
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
        // Lane fills remaining column height; cards scroll inside so all columns share one bottom edge.
        'lawyer-workplace-scroll flex min-h-0 flex-1 flex-col overflow-y-auto rounded-b-lg bg-gray-50/70 p-2 pb-4 transition-colors',
        isDropTarget && 'bg-primary-50/40 ring-primary-400 ring-2 ring-inset'
      )}
    >
      <div className="flex min-h-full flex-col gap-2">
        {column.tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            lawyers={lawyers}
            letterTypes={letterTypes}
            editableLetterTypes={editableLetterTypes}
            isDragging={draggingTaskId === task.id}
            onCardClick={onCardClick}
            onMoveTask={onMoveTask}
            onTaskUpdate={onTaskUpdate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {/* Keeps empty lanes tall enough for drop targets when there are no cards */}
        {column.tasks.length === 0 ? <div className="min-h-8 flex-1" aria-hidden="true" /> : null}
      </div>
    </div>
  )
}
