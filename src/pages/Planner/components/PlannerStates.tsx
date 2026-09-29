/**
 * States of the planner section's blocks (planner story 5.1, AC4; UX-DR14,
 * UX-DR15, EXPERIENCE «State Patterns»):
 *
 * - skeletons repeat the shape of what is loading — a list, a board, a panel;
 *   there is no full-screen spinner anywhere in the section;
 * - an empty state is an icon, one sentence and at most one action;
 * - banners are `Alert`s, one per reason: a list that names the same reason
 *   twice shows it once, so two blocks of a screen can each ask for a banner
 *   without stacking duplicates.
 *
 * Reversible actions confirm with a 5 s «Скасувати» toast (`plannerToasts.ts`);
 * irreversible ones use the CRM `useConfirm` dialog.
 */
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { IconType } from 'react-icons'
import { MdOutlineInbox } from 'react-icons/md'
import { Alert } from '@/components/ui/Alert'

const BLOCK = 'bg-muted motion-safe:animate-pulse rounded'

/** Rows of a task list («Мої задачі», a board list): 44px each, like the row. */
export function TaskListSkeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation('planner')
  return (
    <ul aria-busy="true" className="space-y-2">
      <li className="sr-only">{t('state.loading')}</li>
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} aria-hidden="true" className={`${BLOCK} h-11`} />
      ))}
    </ul>
  )
}

function CardBlocks({ cards }: { cards: number }) {
  return Array.from({ length: cards }, (_, i) => (
    <div key={i} aria-hidden="true" className={`${BLOCK} h-20 rounded-lg`} />
  ))
}

/** Columns of a board, each with a header and two cards. */
export function BoardSkeleton({ columns = 3 }: { columns?: number }) {
  const { t } = useTranslation('planner')
  return (
    <div aria-busy="true" className="flex gap-3 overflow-hidden pb-2">
      <span className="sr-only">{t('state.loading')}</span>
      {Array.from({ length: columns }, (_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="border-border flex w-72 shrink-0 flex-col gap-2 rounded-xl border p-2"
        >
          <div className={`${BLOCK} h-4 w-24`} />
          <CardBlocks cards={2} />
        </div>
      ))}
    </div>
  )
}

/**
 * Cards of one board column while the board's tasks load: the columns (the
 * board's configuration) are already known and drawn, their cards are not —
 * so neither a counter «0» nor «Немає задач» is said yet.
 */
export function ColumnCardsSkeleton({ cards = 2 }: { cards?: number }) {
  const { t } = useTranslation('planner')
  return (
    <div aria-busy="true" className="flex flex-col gap-2">
      <span className="sr-only">{t('state.loading')}</span>
      <CardBlocks cards={cards} />
    </div>
  )
}

/** «Календар» before 5.13–5.14: the box of its empty state, an icon and a line. */
export function CalendarSkeleton() {
  const { t } = useTranslation('planner')
  return (
    <div
      aria-busy="true"
      className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border p-10"
    >
      <span className="sr-only">{t('state.loading')}</span>
      <div aria-hidden="true" className={`${BLOCK} h-10 w-10`} />
      <div aria-hidden="true" className={`${BLOCK} h-4 w-64 max-w-full`} />
    </div>
  )
}

/** The task panel body: a title and four fields. */
export function PanelSkeleton() {
  const { t } = useTranslation('planner')
  return (
    <div aria-busy="true" className="space-y-4">
      <p className="sr-only">{t('panel.loading')}</p>
      <div aria-hidden="true" className={`${BLOCK} h-6 w-3/4`} />
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} aria-hidden="true" className={`${BLOCK} h-10`} />
      ))}
    </div>
  )
}

interface EmptyStateProps {
  text: string
  icon?: IconType
  /** One action that leads further, or none. */
  action?: ReactNode
}

export function PlannerEmptyState({ text, icon: Icon = MdOutlineInbox, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon aria-hidden="true" className="text-muted-foreground h-8 w-8" />
      <p className="text-foreground text-sm">{text}</p>
      {action}
    </div>
  )
}

export interface PlannerBanner {
  /** What the banner is about; one banner per reason. */
  reason: string
  tone: 'info' | 'warning' | 'error'
  text: ReactNode
}

export function PlannerBanners({ banners }: { banners: PlannerBanner[] }) {
  const seen = new Set<string>()
  const unique = banners.filter((banner) => {
    if (seen.has(banner.reason)) return false
    seen.add(banner.reason)
    return true
  })
  if (unique.length === 0) return null
  return (
    <div className="space-y-2">
      {unique.map((banner) => (
        <Alert key={banner.reason} variant={banner.tone} data-reason={banner.reason}>
          {banner.text}
        </Alert>
      ))}
    </div>
  )
}
