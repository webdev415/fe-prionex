import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { KANBAN_COLUMNS, MOCK_KANBAN_TASKS } from '../../kanban/kanbanData'
import {
  GRID_MIN_WIDTH,
  GRID_TEMPLATE,
  LAWYERS,
  TASK_TYPES,
  type DeadlineFilter,
} from './constants'
import { KanbanBoardToolbar } from './KanbanBoardToolbar'
import { KanbanColumnHeader } from './KanbanColumnHeader'
import { KanbanColumnLane } from './KanbanColumnLane'

export function LegalKanbanBoard() {
  const [deadlineFilter, setDeadlineFilter] = useState<DeadlineFilter>('this_week')
  const [lawyerFilter, setLawyerFilter] = useState(LAWYERS[0]!)
  const [typeFilter, setTypeFilter] = useState(TASK_TYPES[0]!)

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

  const totalActive = MOCK_KANBAN_TASKS.length

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
      />

      <div className={cn('px-5 pb-8 lg:px-7', GRID_MIN_WIDTH, 'w-full')}>
        <div
          className="sticky z-10 grid gap-3 bg-[#F2F3F0] backdrop-blur-sm lg:gap-4"
          style={{ top: toolbarHeight, gridTemplateColumns: GRID_TEMPLATE }}
        >
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumnHeader key={col.id} column={col} />
          ))}
        </div>

        <div
          className="grid items-stretch gap-3 lg:gap-4"
          style={{ gridTemplateColumns: GRID_TEMPLATE }}
        >
          {KANBAN_COLUMNS.map((col) => (
            <KanbanColumnLane key={col.id} column={col} />
          ))}
        </div>
      </div>
    </div>
  )
}
