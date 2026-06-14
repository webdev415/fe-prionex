import { useCallback, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { cn } from '@/lib/utils'
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
  GRID_MIN_WIDTH,
  GRID_TEMPLATE,
  LAWYERS,
  TASK_TYPES,
  type DeadlineFilter,
} from './constants'
import { KanbanBoardToolbar } from './KanbanBoardToolbar'
import { KanbanColumnHeader } from './KanbanColumnHeader'
import { KanbanColumnLane } from './KanbanColumnLane'
import { CreateKanbanTaskModal } from './CreateKanbanTaskModal'
import { ThreadDrawer } from './ThreadDrawer'

export function LegalKanbanBoard() {
  const [tasks, setTasks] = useState<KanbanTask[]>(() => [...MOCK_KANBAN_TASKS])
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('this_week')
  const [lawyerFilter, setLawyerFilter] = useState(LAWYERS[0]!)
  const [typeFilter, setTypeFilter] = useState(TASK_TYPES[0]!)
  const [createTaskOpen, setCreateTaskOpen] = useState(false)
  const [threadLetterId, setThreadLetterId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)

  const toolbarRef = useRef<HTMLDivElement>(null)
  const [toolbarHeight, setToolbarHeight] = useState(0)

  useLayoutEffect(() => {
    const el = toolbarRef.current
    if (!el) return
    const sync = () => setToolbarHeight(el.offsetHeight)
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    <div className="w-full min-w-0">
      <KanbanBoardToolbar
        ref={toolbarRef}
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

      <div className={cn('px-5 pb-8 lg:px-7', GRID_MIN_WIDTH, 'w-full')}>
        <div
          className="sticky z-10 grid gap-3 bg-[#F2F3F0] backdrop-blur-sm lg:gap-4"
          style={{ top: toolbarHeight, gridTemplateColumns: GRID_TEMPLATE }}
        >
          {filteredColumns.map((col) => (
            <KanbanColumnHeader key={col.id} column={col} />
          ))}
        </div>

        <div
          className="grid items-stretch gap-3 lg:gap-4"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          {filteredColumns.map((col) => (
            <KanbanColumnLane
              key={col.id}
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
          ))}
        </div>
      </div>
    </div>
  )
}
