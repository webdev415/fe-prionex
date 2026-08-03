/**
 * v3 Priority panel for the client card / detail (KAN-791).
 *
 * Shows the client's debts with their v3 bucket, pay-chance, and the deciding
 * rule ("why this priority"). Renders nothing unless this brand has been cut over
 * (KAN-794 sign-off) and the client has scored debts — so it's safe to drop into
 * the existing client view.
 */

import { V3BucketBadge } from '@/pages/OperatorWorkList/components/V3BucketBadge'
import { exitReasonLabel } from '@/features/scoring/lib/exitReason'
import {
  currentMonthStart,
  useV3Scores,
  useV3UiEnabled,
} from '@/features/scoring/hooks/useV3Scores'

export function V3ClientPriorityPanel({
  projectId,
  clientId,
}: {
  projectId?: number
  clientId?: number
}) {
  const v3UiEnabled = useV3UiEnabled()
  const enabled = v3UiEnabled && !!projectId && !!clientId
  const { data } = useV3Scores(
    projectId,
    { client_id: clientId, month_start: currentMonthStart() },
    { enabled }
  )

  if (!v3UiEnabled) return null
  const rows = data?.results ?? []
  if (rows.length === 0) return null

  return (
    <div className="rounded-xl border border-[#EBECE8] bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#05040D]">v3 Priority</h3>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.debt_id} className="flex flex-wrap items-center gap-3 text-xs">
            <V3BucketBadge bucket={r.bucket_v3} />
            <span className="text-gray-500">Debt {r.debt_id}</span>
            {/* The pay-chance is shown for EXIT debts too. An operator told only
                "do not call" on a debt that is plainly owed will assume the
                system is wrong; seeing the score AND the ground makes the
                exclusion something they can act on rather than argue with. */}
            {r.hazard != null && (
              <span className="text-gray-600">{(r.hazard * 100).toFixed(1)}% pay chance</span>
            )}
            <span className="ml-auto text-gray-500">
              Why:{' '}
              <span className="text-gray-700">
                {r.bucket_v3 === 'EXIT' ? exitReasonLabel(r.exit_reason) : (r.rule_fired ?? '—')}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
