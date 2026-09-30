/**
 * A board of the «Планування» section (planner stories 1.10, 5.1, 5.3).
 *
 * - Header (5.3 AC1): name · code · kind, «Приймає заявки», `Дошка | Список`,
 *   one `+ Задача` (with `create_task`) and `⚙` for whoever may configure it.
 * - Filters (5.3 AC2) live in the address and go to the server as they are.
 * - The kanban (5.3 AC1, AC3) — columns, «ще N», drag and drop and the
 *   keyboard path; the «список» view (5.3 AC4) is the default below 1024 px.
 *
 * Loading (5.1, AC4): until the board's configuration arrives the whole board
 * is a skeleton; after it the real columns stand and only their cards wait.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { usePlannerBoard, usePlannerMe } from '@/api/planner/plannerQueries'
import { readPlannerError } from '@/api/planner/plannerErrors'
import { CreateTaskDialog } from './components/CreateTaskDialog'
import { BoardSkeleton } from './components/PlannerStates'
import { usePlannerTaskParam } from './usePlannerTaskParam'
import { BoardHeader } from './board/BoardHeader'
import { BoardFilters } from './board/BoardFilters'
import { BoardListView } from './board/BoardListView'
import { KanbanBoard } from './board/KanbanBoard'
import { toFilterParams, useBoardFilters, useBoardView } from './board/useBoardFilters'

export function PlannerBoardPage() {
  const { t } = useTranslation('planner')
  const { code = '' } = useParams()
  const board = usePlannerBoard(code)
  const { state, change, clearAll, active } = useBoardFilters()
  const [view, setView] = useBoardView()
  const me = usePlannerMe(state.mine)
  const { openTask } = usePlannerTaskParam()
  const [creating, setCreating] = useState(false)

  if (board.isPending) return <BoardSkeleton />
  if (board.isError || !board.data) {
    const { status } = readPlannerError(board.error)
    return (
      <p className="text-foreground text-sm">
        {status === 404 ? t('board.notFound') : t('board.error')}
      </p>
    )
  }

  const filters = toFilterParams(state, me.data?.user_id)
  const openCreate = () => setCreating(true)

  return (
    <section className="space-y-3" aria-labelledby="planner-board-title">
      <BoardHeader board={board.data} view={view} onViewChange={setView} onCreate={openCreate} />
      <BoardFilters board={board.data} state={state} change={change} clearAll={clearAll} />

      {state.mine && me.isError ? (
        <p className="text-foreground text-sm">{t('board.error')}</p>
      ) : view === 'board' ? (
        <KanbanBoard
          board={board.data}
          filters={filters}
          filtersActive={active}
          onResetFilters={clearAll}
          onCreate={openCreate}
          onOpenTask={openTask}
        />
      ) : (
        <BoardListView
          code={board.data.code}
          filters={filters}
          filtersActive={active}
          onResetFilters={clearAll}
          onOpenTask={openTask}
        />
      )}

      {creating && (
        <CreateTaskDialog
          boardCode={board.data.code}
          onClose={() => setCreating(false)}
          onOpenTask={openTask}
        />
      )}
    </section>
  )
}

export default PlannerBoardPage
