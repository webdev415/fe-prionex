import { useCallback, useMemo, useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import {
  buildKanbanColumns,
  KANBAN_DRAG_MIME,
  MOCK_KANBAN_TASKS,
  moveKanbanTask,
  type KanbanColumnId,
  type KanbanDragPayload,
  type KanbanTask,
} from '../../kanban/kanbanData'
import {
  applyKanbanFilters,
  KANBAN_SCROLL_COLUMN_WIDTH_CLASS,
  type DeadlineFilter,
  type LawyerFilterId,
  type TypeFilterId,
} from './constants'
import {
  KanbanBoardScrollNavigator,
  KANBAN_SCROLL_CONTAINER_ID,
} from './KanbanBoardScrollNavigator'
import { KanbanBoardToolbar } from './KanbanBoardToolbar'
import { KanbanColumnHeader } from './KanbanColumnHeader'
import { KanbanColumnLane } from './KanbanColumnLane'
import { CreateKanbanTaskModal } from './CreateKanbanTaskModal'
import { ThreadDrawer } from './ThreadDrawer'

export function LegalKanbanBoard() {
  const { isKanbanGrid, showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [tasks, setTasks] = useState<KanbanTask[]>(() => [...MOCK_KANBAN_TASKS])
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('this_week')
  const [lawyerFilter, setLawyerFilter] = useState<LawyerFilterId>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilterId>('all')
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [threadLetterId, setThreadLetterId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)

  const columns = useMemo(() => buildKanbanColumns(tasks), [tasks])

  const filteredColumns = useMemo(
    () => applyKanbanFilters(columns, lawyerFilter, typeFilter),
    [columns, lawyerFilter, typeFilter]
  )

  const totalActive = useMemo(
    () => tasks.filter((task) => task.columnId !== 'completed').length,
    [tasks]
  )

  const handleMoveTask = useCallback((taskId: string, toColumnId: KanbanColumnId) => {
    setTasks((prev) => moveKanbanTask(prev, taskId, toColumnId))
  }, [])

  const handleDragStart = useCallback((event: DragEvent, task: KanbanTask) => {
    if (task.columnId === 'completed') {
      event.preventDefault()
      return
    }

    const payload: KanbanDragPayload = {
      taskId: task.id,
      fromColumnId: task.columnId,
    }
    event.dataTransfer.setData(KANBAN_DRAG_MIME, JSON.stringify(payload))
    event.dataTransfer.effectAllowed = 'move'
    setDraggingTaskId(task.id)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null)
    setDragOverColumn(null)
  }, [])

  const handleDragOver = useCallback((event: DragEvent, columnId: KanbanColumnId) => {
    if (Array.from(event.dataTransfer.types).includes(KANBAN_DRAG_MIME)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDragOverColumn((prev) => (prev === columnId ? prev : columnId))
    }
  }, [])

  const handleDragLeave = useCallback((columnId: KanbanColumnId) => {
    setDragOverColumn((prev) => (prev === columnId ? null : prev))
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent, columnId: KanbanColumnId) => {
      event.preventDefault()
      setDragOverColumn(null)
      setDraggingTaskId(null)

      const raw = event.dataTransfer.getData(KANBAN_DRAG_MIME)
      if (!raw) return

      let payload: KanbanDragPayload
      try {
        payload = JSON.parse(raw) as KanbanDragPayload
      } catch {
        return
      }

      if (payload.fromColumnId === columnId) return
      handleMoveTask(payload.taskId, columnId)
    },
    [handleMoveTask]
  )

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <KanbanBoardToolbar
        totalActive={totalActive}
        deadlineFilter={deadlineFilter}
        onDeadlineFilterChange={setDeadlineFilter}
        lawyerFilter={lawyerFilter}
        onLawyerFilterChange={setLawyerFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        onNewTask={() => setCreateTaskOpen(true)}
      />

      <CreateKanbanTaskModal open={createTaskOpen} onClose={() => setCreateTaskOpen(false)} />

      <ThreadDrawer letterId={threadLetterId} onClose={() => setThreadLetterId(null)} />

      <div
        className={cn(
          'lawyer-workplace-scroll min-h-0 flex-1 overflow-y-auto',
          isKanbanGrid
            ? showWorkspaceBanner
              ? 'pb-24'
              : 'pb-6'
            : showWorkspaceBanner
              ? 'pb-36'
              : 'pb-20'
        )}
      >
        <div
          id={KANBAN_SCROLL_CONTAINER_ID}
          ref={scrollContainerRef}
          className={cn(
            'overscroll-x-contain',
            isKanbanGrid
              ? 'overflow-x-visible'
              : cn(
                  'overflow-x-auto scroll-smooth px-4 sm:px-5 lg:px-7',
                  '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
                )
          )}
        >
          <div
            className={cn(
              'pb-6',
              isKanbanGrid
                ? 'grid w-full grid-cols-4 gap-3 px-4 sm:px-5 lg:gap-4 lg:px-7'
                : 'flex w-max snap-x snap-mandatory gap-3 lg:gap-4'
            )}
          >
            {filteredColumns.map((col) => (
              <div
                key={col.id}
                className={cn(
                  'flex flex-col',
                  isKanbanGrid
                    ? 'min-w-0 shrink'
                    : cn('shrink-0 snap-start', KANBAN_SCROLL_COLUMN_WIDTH_CLASS)
                )}
              >
                <div className="sticky top-0 z-10">
                  <KanbanColumnHeader column={col} />
                </div>
                <KanbanColumnLane
                  column={col}
                  draggingTaskId={draggingTaskId}
                  isDropTarget={dragOverColumn === col.id}
                  onCardClick={setThreadLetterId}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={(event) => handleDragOver(event, col.id)}
                  onDragLeave={() => handleDragLeave(col.id)}
                  onDrop={(event) => handleDrop(event, col.id)}
                  onMoveTask={handleMoveTask}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {!isKanbanGrid && (
        <KanbanBoardScrollNavigator
          scrollContainerRef={scrollContainerRef}
          columns={filteredColumns}
        />
      )}
    </div>
  )
}
