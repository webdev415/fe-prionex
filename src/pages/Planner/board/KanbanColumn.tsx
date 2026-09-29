/**
 * Kanban column = one status of the board (planner story 5.3, AC1; UX-DR18,
 * DESIGN «Колонка доски 288px», U-7, U-8).
 *
 * Header: the category dot, the status name (11/600 upper case with spacing,
 * as CRM column titles are), the SLA mode icon (paused / not counted) and the
 * «повідомити автора» bell — each explained by a tooltip on hover AND on focus
 * — and the count of the column's tasks after the filters (`total` of the
 * server). No WIP limit. At most 50 cards; beyond them «ще N» leads to the
 * «список» view. A «готово» column holds the tasks closed within 7 days and,
 * when it has any, links «Закриті за 7 днів →» to the list. The list of
 * contract 0.24.0 has no status filter: both links open the whole board's
 * list under the same filters, and their accessible names say so. `+` stands
 * only in the column of the default status: the server decides where a new
 * task goes (FR-9).
 *
 * The column's card area is a drop target: a card dropped on its free space
 * goes to the end of the column. While the tasks are unknown the column says
 * nothing about its count (5.1).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import type { IconType } from 'react-icons'
import { MdAdd, MdNotificationsNone, MdPauseCircleOutline, MdTimerOff } from 'react-icons/md'
import {
  dropTargetForElements,
  type ElementDropTargetEventBasePayload,
} from '@atlaskit/pragmatic-drag-and-drop/adapter/element-adapter'
import { formatNumber } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import type { PlannerBoardStatus, PlannerKanbanColumn } from '@/api/planner/plannerApi'
import { ColumnCardsSkeleton } from '../components/PlannerStates'
import { PlannerTooltip } from '../components/PlannerTooltip'
import { CATEGORY_DOT } from '../plannerTones'
import { COLUMN_TARGET, columnAccepts, isCardDrag } from './dnd'
import { listViewSearch } from './useBoardFilters'

interface KanbanColumnProps {
  status: PlannerBoardStatus
  /** The server's column; undefined while the tasks load or failed. */
  column: PlannerKanbanColumn | undefined
  loading: boolean
  /** The whole board is empty: it says so once, not in every column. */
  boardEmpty: boolean
  /** A card is being dragged that this column would take (`columnAccepts`). */
  dropInvited: boolean
  canCreate: boolean
  onCreate: () => void
  children: ReactNode
}

function HeaderIcon({ icon: Icon, label }: { icon: IconType; label: string }) {
  return (
    <PlannerTooltip label={label}>
      <span
        role="img"
        aria-label={label}
        // The explanation opens on keyboard focus as on hover (UX-DR18).
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="text-muted-foreground focus-visible:ring-ring inline-flex h-5 w-5 shrink-0 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none"
      >
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      </span>
    </PlannerTooltip>
  )
}

export function KanbanColumn({
  status,
  column,
  loading,
  boardEmpty,
  dropInvited,
  canCreate,
  onCreate,
  children,
}: KanbanColumnProps) {
  const { t, i18n } = useTranslation('planner')
  const language = i18n.language ?? 'uk'
  const location = useLocation()
  const areaRef = useRef<HTMLDivElement>(null)
  const [over, setOver] = useState(false)

  useEffect(() => {
    const element = areaRef.current
    if (!element) return
    // The column lights up as the card's destination: always for a card from
    // another column; for its own card only over the free space (its end) —
    // over a card the insertion line says where it goes.
    const lights = ({ source, location }: ElementDropTargetEventBasePayload) =>
      isCardDrag(source.data) &&
      (source.data.statusId !== status.id || location.current.dropTargets[0]?.element === element)
    return dropTargetForElements({
      element,
      getData: () => ({ type: COLUMN_TARGET, statusId: status.id }),
      canDrop: ({ source }) => isCardDrag(source.data) && columnAccepts(source.data, status.id),
      onDragEnter: (payload) => setOver(lights(payload)),
      onDrag: (payload) => setOver(lights(payload)),
      onDragLeave: () => setOver(false),
      onDrop: () => setOver(false),
    })
  }, [status.id])

  const items = column?.items.length ?? 0
  const more = column ? column.total - items : 0
  const listHref = { search: listViewSearch(location.search) }

  return (
    <section
      aria-label={status.name}
      className="bg-muted/40 border-border flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-3"
    >
      <header className="text-foreground flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOT[status.category]}`}
          />
          <span className="truncate text-[11px] font-semibold tracking-wider uppercase">
            {status.name}
          </span>
          {status.sla_mode === 'paused' && (
            <HeaderIcon icon={MdPauseCircleOutline} label={t('kanban.slaPaused')} />
          )}
          {status.sla_mode === 'off' && <HeaderIcon icon={MdTimerOff} label={t('kanban.slaOff')} />}
          {status.notify_author && (
            <HeaderIcon icon={MdNotificationsNone} label={t('kanban.notifyAuthor')} />
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {column && (
            <span className="text-muted-foreground text-xs tabular-nums">
              {/* A bare «12» says nothing to a screen reader (UX-DR46). */}
              <span className="sr-only">{t('kanban.countLabel')} </span>
              {formatNumber(column.total, language)}
            </span>
          )}
          {status.default && canCreate && (
            <button
              type="button"
              onClick={onCreate}
              className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring inline-flex h-6 w-6 items-center justify-center rounded focus-visible:ring-2 focus-visible:outline-none"
            >
              <MdAdd aria-hidden="true" className="h-4 w-4" />
              <span className="sr-only">{t('kanban.newTaskIn', { status: status.name })}</span>
            </button>
          )}
        </span>
      </header>

      <div
        ref={areaRef}
        data-column-drop={status.id}
        className={cn(
          'flex min-h-16 flex-col gap-2 rounded-lg transition-colors',
          over && 'bg-secondary-600/10'
        )}
      >
        {loading && <ColumnCardsSkeleton />}
        {column && items === 0 && !boardEmpty && (
          <p className="border-border text-muted-foreground rounded-lg border border-dashed px-2 py-4 text-center text-xs">
            {dropInvited ? t('kanban.dropHere') : t('board.emptyColumn')}
          </p>
        )}
        {children}
      </div>

      {more > 0 && (
        <Link to={listHref} className="text-foreground px-1 text-xs font-medium underline">
          {t('kanban.more', { value: formatNumber(more, language) })}
          <span className="sr-only"> — {t('kanban.moreLabel')}</span>
        </Link>
      )}
      {/* Nothing closed within 7 days — nothing to open. */}
      {status.category === 'done' && column && column.total > 0 && (
        <Link to={listHref} className="text-muted-foreground px-1 text-xs underline">
          {t('kanban.allClosed')} <span aria-hidden="true">→</span>
          <span className="sr-only"> — {t('kanban.moreLabel')}</span>
        </Link>
      )}
    </section>
  )
}

export default KanbanColumn
