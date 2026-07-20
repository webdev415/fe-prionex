import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import { useTeamRoster } from '@/features/quality/coaching/hooks'
import { useScopedUserIds } from '../../lib/scope'
import { deriveDepartmentChips, deriveTeamRoster } from '../../lib/teamRosterAdapter'
import type { TeamDepartmentRow } from '../../mocks/trainerWorkplaceMocks'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import type { SegmentedStripItem } from '../chrome/TrainingSegmentedStrip'
import { DepartmentCard } from './DepartmentCard'
import { LeaderboardView } from './LeaderboardView'

type TeamViewMode = 'roster' | 'leaderboard'

/**
 * Team top-tab — Figma `ENG - Training _ Team.svg` (KAN-414).
 *
 * Renders the department → team → operator tree from
 * `GET /api/v1/quality/coaching/team-roster`. Clicking an operator card
 * opens the shared `OperatorDetailPanel` (same component the Inbox uses,
 * per the KAN-413 §1.8 reuse contract). Composite scores match the
 * Inbox-queue numbers exactly because both surfaces go through
 * `queue_service.compute_queue`.
 */
/** Figma — `In norm / Behind / In queue` dot legend shown to the right of the
 *  department filter chips. Explains the operator-row status indicators. */
const STATUS_LEGEND = [
  {
    id: 'in_norm',
    dot: 'bg-[#22C55E]',
    key: 'pages.training.team.workStatus.inNorm',
    fallback: 'In norm',
  },
  {
    id: 'behind',
    dot: 'bg-[#CA8A04]',
    key: 'pages.training.team.workStatus.behind',
    fallback: 'Behind',
  },
  {
    id: 'in_queue',
    dot: 'bg-[#EF4444]',
    key: 'pages.training.team.workStatus.inQueue',
    fallback: 'In queue',
  },
] as const

interface RosterViewProps {
  chips: SegmentedStripItem[]
  activeDepartmentId: string
  setDepartment: (id: string) => void
  isLoading: boolean
  isError: boolean
  visibleDepartments: TeamDepartmentRow[]
}

/** Hoisted to module scope so the component identity stays stable across
 *  TeamTab re-renders. Defining it inside TeamTab created a new component
 *  type on every render and forced React to unmount + remount the entire
 *  department/team/operator subtree. */
function RosterView({
  chips,
  activeDepartmentId,
  setDepartment,
  isLoading,
  isError,
  visibleDepartments,
}: RosterViewProps) {
  const { t } = useTranslation('common')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TrainingSegmentedStrip
          items={chips}
          activeId={activeDepartmentId}
          onChange={setDepartment}
          showActiveClose
        />

        <div className="flex items-center gap-4">
          {STATUS_LEGEND.map((item) => (
            <span
              key={item.id}
              className="flex items-center gap-1.5 text-xs font-medium text-[#05040D]"
            >
              <span className={`inline-block h-2 w-2 rounded-full ${item.dot}`} />
              {t(item.key, item.fallback)}
            </span>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
          {t('pages.training.team.loading', 'Loading team roster…')}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-red-500">
          {t('pages.training.team.error', 'Could not load team roster.')}
        </div>
      ) : visibleDepartments.length === 0 ? (
        <div className="rounded-xl border border-[#EBECE8] bg-white p-6 text-center text-xs text-gray-500">
          {t('pages.training.team.empty', 'No departments in the current scope.')}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleDepartments.map((dept) => (
            <DepartmentCard key={dept.id} department={dept} />
          ))}
        </div>
      )}
    </div>
  )
}

export function TeamTab() {
  const { t } = useTranslation('common')
  const [searchParams, setSearchParams] = useSearchParams()
  const userPermissions = useAuthStore((s) => s.user?.permissions ?? [])
  const activeProjectId = useAuthStore((s) => s.user?.active_project_id)
  const currentUserId = useAuthStore((s) => (s.user?.id ? Number(s.user.id) : null))

  const { data: operators = [] } = useOperators(activeProjectId ? Number(activeProjectId) : null)
  const scoped = useScopedUserIds(operators)

  // Same scope-gating rule as Inbox — no separate `select_team_scope`.
  const canSelectScope = userPermissions.includes(PERMISSIONS.TRAINING.SELECT_INBOX_SCOPE)
  const effectiveUserIds = useMemo<number[] | undefined>(() => {
    if (!canSelectScope) {
      return currentUserId != null ? [currentUserId] : []
    }
    return scoped.userIds
  }, [canSelectScope, currentUserId, scoped.userIds])

  // ?department= URL state. The chip strip is derived from the response.
  const rawDepartment = searchParams.get('department')
  const activeDepartmentId = rawDepartment ?? 'all'

  // ?view=roster|leaderboard — Leaderboard is the KAN-411 Feature 3.2 sub-
  // view. Default 'roster' keeps existing behaviour for users hitting
  // /training?tab=team without the new query.
  const rawView = searchParams.get('view')
  const activeView: TeamViewMode = rawView === 'leaderboard' ? 'leaderboard' : 'roster'
  const setView = (next: TeamViewMode) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'roster') params.delete('view')
    else params.set('view', next)
    setSearchParams(params, { replace: true })
  }

  const departmentIdFilter = useMemo<number | undefined>(() => {
    if (rawDepartment == null || rawDepartment === 'all') return undefined
    const match = /^dept-(-?\d+)$/.exec(rawDepartment)
    if (!match) return undefined
    const parsed = Number(match[1])
    return Number.isFinite(parsed) ? parsed : undefined
  }, [rawDepartment])

  const {
    data: rosterPayload,
    isLoading,
    isError,
  } = useTeamRoster(
    {
      department_id: departmentIdFilter,
      user_ids: effectiveUserIds,
    },
    (effectiveUserIds?.length ?? 0) > 0 || effectiveUserIds === undefined
  )

  const departments = useMemo(
    () => (rosterPayload ? deriveTeamRoster(t, rosterPayload) : []),
    [rosterPayload, t]
  )

  const chips = useMemo(() => {
    const dynamic = rosterPayload ? deriveDepartmentChips(rosterPayload) : []
    return [
      {
        id: 'all',
        label: t('pages.training.team.chips.all', 'All my departments'),
        count: dynamic.length,
      },
      ...dynamic.map((c) => ({ id: c.id, label: c.label, count: c.count })),
    ]
  }, [rosterPayload, t])

  const visibleDepartments = useMemo(() => {
    if (activeDepartmentId === 'all') return departments
    return departments.filter((d) => d.id === activeDepartmentId)
  }, [departments, activeDepartmentId])

  const setDepartment = (id: string) => {
    const next = new URLSearchParams(searchParams)
    if (id === 'all') next.delete('department')
    else next.set('department', id)
    setSearchParams(next, { replace: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="inline-flex max-w-full flex-wrap gap-1 self-start rounded-lg border border-[#EBECE8] bg-white p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        {(['roster', 'leaderboard'] as const).map((mode) => {
          const isActive = mode === activeView
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium tracking-[-0.02em] transition-colors ${
                isActive ? 'bg-[#204E4D] text-white' : 'text-[#545454] hover:bg-[#F7F7F7]'
              }`}
            >
              {mode === 'roster'
                ? t('pages.training.team.view.roster', 'Roster')
                : t('pages.training.team.view.leaderboard', 'Leaderboard')}
            </button>
          )
        })}
      </div>

      {activeView === 'leaderboard' ? (
        <LeaderboardView />
      ) : (
        <RosterView
          chips={chips}
          activeDepartmentId={activeDepartmentId}
          setDepartment={setDepartment}
          isLoading={isLoading}
          isError={isError}
          visibleDepartments={visibleDepartments}
        />
      )}
    </div>
  )
}

export default TeamTab
