/**
 * Board header (planner story 5.3, AC1; UX-DR16): name · code · kind, the
 * «Приймає заявки» badge, the `Дошка | Список` switcher, ONE call to action
 * `+ Задача` (only with `create_task`) and `⚙` for whoever may configure the
 * board (`configure` in the board's `allowed_actions`). The «Огляд» summary line
 * under the header is story 5.12.
 *
 * `⚙` opens the board's settings editor (story 5.10, C-08) on its first
 * section «Загальне»; the editor itself answers «Немає прав» to a direct
 * address without `configure`.
 */
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { MdInbox, MdOutlineSettings } from 'react-icons/md'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { PlannerBoard } from '@/api/planner/plannerApi'
import { boardSettingsPath } from '../settings/boardSettingsModel'
import type { BoardView } from './useBoardFilters'

interface BoardHeaderProps {
  board: PlannerBoard
  view: BoardView
  onViewChange: (view: BoardView) => void
  onCreate: () => void
}

export function BoardHeader({ board, view, onViewChange, onCreate }: BoardHeaderProps) {
  const { t } = useTranslation('planner')
  const canCreate = board.allowed_actions.includes('create_task')
  const canConfigure = board.allowed_actions.includes('configure')
  // A board read before its policy existed has no `policy.value` — no badge then.
  const intakeOpen = board.config.policy?.value?.intake_open === true

  const viewButton = (value: BoardView, label: string) => (
    <button
      type="button"
      aria-pressed={view === value}
      onClick={() => onViewChange(value)}
      className={cn(
        'focus-visible:ring-ring rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
        view === value ? 'bg-primary-300 text-primary-foreground' : 'text-foreground hover:bg-muted'
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id="planner-board-title" className="text-foreground text-base font-semibold">
          <span className="text-muted-foreground mr-2 font-mono text-sm">{board.code}</span>
          {board.name}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">{t(`boardHeader.kind.${board.kind}`)}</span>
          {intakeOpen && (
            <span className="text-information-700 bg-information-50 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
              <MdInbox aria-hidden="true" className="h-3.5 w-3.5" />
              {t('boardHeader.intakeOpen')}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label={t('boardHeader.viewLabel')}
          className="border-border inline-flex items-center gap-1 rounded-full border p-0.5"
        >
          {viewButton('board', t('boardHeader.viewBoard'))}
          {viewButton('list', t('boardHeader.viewList'))}
        </div>
        {canCreate && (
          <Button size="sm" onClick={onCreate}>
            {t('board.newTask')}
          </Button>
        )}
        {canConfigure && (
          <Link
            to={boardSettingsPath(board.code)}
            className="text-foreground hover:bg-muted focus-visible:ring-ring inline-flex h-8 w-8 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
          >
            <MdOutlineSettings aria-hidden="true" className="h-5 w-5" />
            <span className="sr-only">{t('boardHeader.settings')}</span>
          </Link>
        )}
      </div>
    </div>
  )
}

export default BoardHeader
