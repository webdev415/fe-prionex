import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { PERMISSIONS } from '@/constants/permissions'
import { useAuthStore } from '@/stores/authStore'
import { useOperators } from '@/features/users/hooks'
import {
  useTakeCharge,
  useTeamRoster,
} from '@/features/quality/coaching/hooks'
import { OperatorDetailPanel } from '@/features/quality/coaching/components/OperatorDetailPanel'
import { useScopedUserIds } from '../../lib/scope'
import { deriveDepartmentChips, deriveTeamRoster } from '../../lib/teamRosterAdapter'
import { TrainingSegmentedStrip } from '../chrome/TrainingSegmentedStrip'
import { DepartmentCard } from './DepartmentCard'

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
export interface TeamTabProps {
  onOpenRateDialogue?: () => void
  onOpenScheduleOneOnOne?: () => void
  onOpenAssignTask?: () => void
}

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

export function TeamTab({
  onOpenRateDialogue,
  onOpenScheduleOneOnOne,
  onOpenAssignTask,
}: TeamTabProps = {}) {
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

  const departmentIdFilter = useMemo<number | undefined>(() => {
    if (rawDepartment == null || rawDepartment === 'all') return undefined
    const match = /^dept-(-?\d+)$/.exec(rawDepartment)
    if (!match) return undefined
    const parsed = Number(match[1])
    return Number.isFinite(parsed) ? parsed : undefined
  }, [rawDepartment])

  const { data: rosterPayload, isLoading, isError } = useTeamRoster(
    {
      department_id: departmentIdFilter,
      user_ids: effectiveUserIds,
    },
    (effectiveUserIds?.length ?? 0) > 0 || effectiveUserIds === undefined
  )

  const departments = useMemo(
    () => (rosterPayload ? deriveTeamRoster(rosterPayload) : []),
    [rosterPayload]
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

  // ── Operator detail panel ──────────────────────────────────────────
  // Same ?operator_id= URL param the Inbox writes, so a deep link works
  // across both tabs.
  const selectedOperatorId = useMemo(() => {
    const raw = searchParams.get('operator_id')
    if (!raw) return undefined
    const id = Number(raw)
    return Number.isFinite(id) ? id : undefined
  }, [searchParams])

  const setSelectedOperator = (id: number | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (id) next.set('operator_id', String(id))
    else next.delete('operator_id')
    setSearchParams(next, { replace: true })
  }

  // Pull metadata for the panel header from the loaded roster — saves a
  // join inside the panel itself.
  const selectedRow = useMemo(() => {
    if (!selectedOperatorId) return undefined
    for (const dept of departments) {
      for (const team of dept.teams) {
        const op = team.operators.find((o) => o.id === selectedOperatorId)
        if (op) {
          return { operator: op, team, department: dept }
        }
      }
    }
    return undefined
  }, [departments, selectedOperatorId])

  const takeChargeMutation = useTakeCharge()
  const canTakeCharge = userPermissions.includes(PERMISSIONS.TRAINING.MANAGE_COACHING_ASSIGNMENTS)
  const handleTakeCharge = async () => {
    if (!selectedOperatorId) return
    if (!canTakeCharge) {
      toast.error(
        t(
          'pages.training.inbox.takeCharge.forbidden',
          'You do not have permission to take charge of operators.'
        )
      )
      return
    }
    try {
      await takeChargeMutation.mutateAsync({ operator_id: selectedOperatorId })
      toast.success(
        t('pages.training.inbox.takeCharge.success', 'You are now coaching this operator.')
      )
    } catch (err) {
      const detail =
        err instanceof Error
          ? err.message
          : t('pages.training.inbox.takeCharge.errors.generic', 'Could not take charge.')
      toast.error(detail)
    }
  }

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
        <div
          className={
            selectedOperatorId
              ? 'grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_360px]'
              : 'grid grid-cols-1 gap-3'
          }
        >
          <div className="flex flex-col gap-4">
            {visibleDepartments.map((dept) => (
              <DepartmentCard
                key={dept.id}
                department={dept}
                onSelectOperator={setSelectedOperator}
              />
            ))}
          </div>

          {selectedOperatorId ? (
            <div className="min-h-[400px]">
              <OperatorDetailPanel
                operatorId={selectedOperatorId}
                operatorName={selectedRow?.operator.name}
                avatarColor={selectedRow?.operator.avatarColor}
                initials={selectedRow?.operator.initials}
                online={selectedRow?.operator.online}
                department={selectedRow?.department.name}
                segment={selectedRow?.team.name}
                onListen={
                  onOpenRateDialogue ??
                  (() =>
                    toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
                }
                onPlanOneOnOne={
                  onOpenScheduleOneOnOne ??
                  (() =>
                    toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
                }
                onAssignTask={
                  onOpenAssignTask ??
                  (() =>
                    toast.info(t('pages.training.inbox.quickActions.comingSoon', 'Coming soon')))
                }
                onTakeCharge={handleTakeCharge}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default TeamTab
