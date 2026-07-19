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
  timezone?: string | null
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
  timezone,
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
        // No per-column scroll. Height = cards + min 100vh spacer; stretch fills to tallest sibling.
        'bg-muted/70 flex min-h-0 flex-1 flex-col rounded-b-lg p-2 pb-4 transition-colors',
        isDropTarget && 'bg-primary-50/40 ring-primary-400 ring-2 ring-inset'
      )}
    >
      <div className="flex shrink-0 flex-col gap-2">
        {column.tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            lawyers={lawyers}
            letterTypes={letterTypes}
            editableLetterTypes={editableLetterTypes}
            timezone={timezone}
            isDragging={draggingTaskId === task.id}
            onCardClick={onCardClick}
            onMoveTask={onMoveTask}
            onTaskUpdate={onTaskUpdate}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
      {/*
        Equal height = tallest column cards + 100vh:
        - min-h-[100vh] guarantees the +100vh sum on every lane
        - flex-1 grows shorter lanes to match the tallest sibling via items-stretch
      */}
      <div className="min-h-[100vh] flex-1" aria-hidden="true" />
    </div>
  )
}
