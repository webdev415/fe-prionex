/**
 * Second-level switcher inside «Задачі»: `Мої задачі · Дошка ▾`
 * (planner story 1.9, AC2; UX U-5). The board list comes from `GET /boards` —
 * the boards where the person is a participant — grouped by kind. «Вихідні
 * заявки», «Огляд» and the templates gear arrive with their own stories.
 */
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { cn } from '@/lib/utils'
import { usePlannerBoards } from '@/api/planner/plannerQueries'
import type { PlannerBoardSummary } from '@/api/planner/plannerApi'
import { boardPath, PLANNER_TASKS_PATH } from '../plannerFormat'

const GROUP_ORDER: PlannerBoardSummary['kind'][] = ['department', 'team', 'personal']

interface TasksNavProps {
  /** Code of the open board, or null on «Мої задачі». */
  activeBoard: string | null
}

export function TasksNav({ activeBoard }: TasksNavProps) {
  const { t } = useTranslation('planner')
  const navigate = useNavigate()
  const boards = usePlannerBoards()
  const items = boards.data?.items ?? []
  const current = activeBoard ? items.find((board) => board.code === activeBoard) : undefined

  const pill = (active: boolean) =>
    cn(
      'rounded-full px-3 py-1 text-sm transition-colors',
      active ? 'bg-primary-300 text-primary-foreground' : 'text-foreground hover:bg-muted'
    )

  return (
    <nav aria-label={t('tasksNav.ariaLabel')} className="flex items-center gap-2">
      <Link
        to={PLANNER_TASKS_PATH}
        className={pill(activeBoard === null)}
        aria-current={activeBoard === null ? 'page' : undefined}
      >
        {t('tasksNav.mine')}
      </Link>
      <span aria-hidden="true" className="text-muted-foreground">
        ·
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className={pill(activeBoard !== null)}>
            {current ? `${t('tasksNav.board')}: ${current.name}` : t('tasksNav.board')}{' '}
            <span aria-hidden="true">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[16rem]">
          {boards.isError && (
            <DropdownMenuItem disabled>{t('tasksNav.boardsError')}</DropdownMenuItem>
          )}
          {boards.isSuccess && items.length === 0 && (
            <DropdownMenuItem disabled>{t('tasksNav.noBoards')}</DropdownMenuItem>
          )}
          {GROUP_ORDER.map((kind) => {
            const group = items.filter((board) => board.kind === kind)
            if (group.length === 0) return null
            return (
              <div key={kind}>
                <DropdownMenuLabel className="text-muted-foreground text-xs">
                  {t(`tasksNav.groups.${kind}`)}
                </DropdownMenuLabel>
                {group.map((board) => (
                  <DropdownMenuItem
                    key={board.code}
                    className="cursor-pointer"
                    onSelect={() => navigate(boardPath(board.code))}
                  >
                    <span className="text-muted-foreground mr-2 font-mono text-xs">
                      {board.code}
                    </span>
                    {board.name}
                  </DropdownMenuItem>
                ))}
              </div>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}

export default TasksNav
