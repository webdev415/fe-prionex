/**
 * v3 Priority panel for the client card / detail (KAN-791).
 *
 * Shows the client's debts with their v3 bucket, pay-chance, and the deciding
 * rule ("why this priority"). Renders nothing unless this brand has been cut over
 * (KAN-794 sign-off) and the client has scored debts — so it's safe to drop into
 * the existing client view.
 */

import { useTranslation } from 'react-i18next'
import { V3BucketBadge } from '@/pages/OperatorWorkList/components/V3BucketBadge'
import { uiDecimal } from '@/lib/formatters'
import { exitReasonLabel } from '@/features/scoring/lib/exitReason'
import {
  currentMonthStart,
  useV3Scores,
  useV3UiEnabled,
} from '@/features/scoring/hooks/useV3Scores'

export function V3ClientPriorityPanel({
  projectId,
  clientId,
  open = true,
  id,
}: {
  projectId?: number
  clientId?: number
  /**
   * Whether the panel body is shown. Defaults to open so the two call sites
   * that render it inline are unchanged; the client card passes the state of
   * the priority chip that discloses it.
   */
  open?: boolean
  /** Ties the panel to the chip's ``aria-controls``. */
  id?: string
}) {
  const { t } = useTranslation('common')
  const v3UiEnabled = useV3UiEnabled()
  // The query stays enabled while collapsed: the chip above is driven by the
  // same scores, so the data is wanted either way, and fetching only on expand
  // would put a spinner behind a click that reads as instant.
  const enabled = v3UiEnabled && !!projectId && !!clientId
  const { data } = useV3Scores(
    projectId,
    { client_id: clientId, month_start: currentMonthStart() },
    { enabled }
  )

  if (!v3UiEnabled) return null
  if (!open) return null
  const rows = data?.results ?? []

  // No v3 rows means the model does not cover this client — their debts sit
  // outside its range. Rendering nothing left an operator wondering whether the
  // panel had failed to load; saying so is short and removes the doubt.
  if (rows.length === 0) {
    return (
      <div id={id} className="border-border bg-card rounded-xl border border-dashed p-4">
        <h3 className="text-foreground mb-1 text-sm font-semibold">
          {t('pages.scoringV3.panel.title')}
        </h3>
        <p className="text-muted-foreground text-xs">{t('pages.scoringV3.panel.notScored')}</p>
      </div>
    )
  }

  return (
    <div id={id} className="border-border bg-card rounded-xl border p-4">
      <h3 className="text-foreground mb-3 text-sm font-semibold">
        {t('pages.scoringV3.panel.title')}
      </h3>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <div key={r.debt_id} className="flex flex-wrap items-center gap-3 text-xs">
            <V3BucketBadge bucket={r.bucket_v3} />
            <span className="text-muted-foreground">
              {t('pages.scoringV3.panel.debt', { id: r.debt_id })}
            </span>
            {/* The pay-chance is shown for EXIT debts too. An operator told only
                "do not call" on a debt that is plainly owed will assume the
                system is wrong; seeing the score AND the ground makes the
                exclusion something they can act on rather than argue with. */}
            {r.hazard != null && (
              <span className="text-muted-foreground">
                {t('pages.scoringV3.panel.payChance', {
                  value: uiDecimal((r.hazard * 100).toFixed(1)),
                })}
              </span>
            )}
            <span className="text-muted-foreground ml-auto">
              {t('pages.scoringV3.panel.why')}{' '}
              <span className="text-foreground">
                {r.bucket_v3 === 'EXIT' ? exitReasonLabel(r.exit_reason) : (r.rule_fired ?? '—')}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
