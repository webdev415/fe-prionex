/**
 * VerificationTable Component
 *
 * "Верифікація 3-х осіб" per-operator table (6 columns) built on the shared
 * DataTable. The component only formats and colours — rows arrive pre-sorted
 * by `numbers_added` descending from the backend (Card 128 parity) and are
 * never re-sorted here.
 *
 * Colouring follows the Techno-Finance reference implementation:
 * «Верифіковано» is filled over [0 .. max(month_plan)], «Унікальних клієнтів»
 * over the column's own [min .. max], and «Недостача до плану» gets a text
 * colour only (red below plan, green on/above it) — no fill.
 *
 * Two deliberate differences from that reference:
 *   * the plan and the shortfall are NOT truncated to integers (TF pushed both
 *     through `_to_int`, displaying a rookie's 1198.8 as 1198). The backend
 *     documents the exact-decimal contract, so we format with decimals;
 *   * `month_plan === null` (zero active ТП headcount) renders "—" with no
 *     fill and no colour instead of a fake 0.
 */

import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { formatNumber } from '@/lib/localeFormat'
import { cn } from '@/lib/utils'
import type { ThirdPartyVerificationRow } from '../types'
import {
  planDiffTone,
  verificationCellBackground,
  verificationGradientBounds,
} from '../utils/verificationGradient'

export interface VerificationTableProps {
  rows: ThirdPartyVerificationRow[]
}

/** DataTable requires an `id`; user_id is unique per row (and stable across renames). */
type VerificationTableRow = ThirdPartyVerificationRow & { id: number }

/**
 * Plan figures may be fractional (rookie coefficient → 1198.8). Two decimals
 * max keeps whole numbers clean ("1,198") while never truncating a real
 * fraction ("1,198.8").
 */
const PLAN_NUMBER_OPTIONS: Intl.NumberFormatOptions = { maximumFractionDigits: 2 }

function GradientValue({
  value,
  min,
  max,
  language,
}: {
  value: number | string | null | undefined
  min: number
  max: number
  language: string
}) {
  const background = verificationCellBackground(value, min, max)

  return (
    <span
      className="inline-block min-w-16 rounded-md px-2 py-1 tabular-nums"
      // The fill is computed per value — it cannot be a static Tailwind class.
      // The text colour is hardcoded alongside it (TagBadge / ProcessingTable
      // precedent): the dark-500 token is theme-scoped and flips to near-white
      // in dark themes (src/theme/themes.css), which would be unreadable on
      // the light pastel fill.
      style={background ? { backgroundColor: background, color: '#05040d' } : undefined}
    >
      {formatNumber(value, language)}
    </span>
  )
}

function PlanDiffValue({
  value,
  language,
}: {
  value: number | string | null | undefined
  language: string
}): ReactNode {
  const tone = planDiffTone(value)

  return (
    <span
      className={cn(
        'tabular-nums',
        // This cell has NO computed background — it sits on the theme's own
        // card surface, so the colour must follow the theme instead of being
        // pinned inline: error/success-500 resolve to #ef4444/#22c55e on light
        // themes and to the lighter #f87171/#4ade80 in dark ones
        // (src/theme/themes.css). A hardcoded hex here would be the same
        // unreadable-contrast bug as a theme token over a computed fill, just
        // inverted. Missing values stay in the default text colour.
        tone === 'negative' && 'text-error-500 font-medium',
        tone === 'positive' && 'text-success-500 font-medium'
      )}
    >
      {formatNumber(value, language, PLAN_NUMBER_OPTIONS)}
    </span>
  )
}

export function VerificationTable({ rows }: VerificationTableProps) {
  const { t, i18n } = useTranslation('common')
  const language = i18n.language

  const data: VerificationTableRow[] = useMemo(
    () => rows.map((row) => ({ ...row, id: row.user_id })),
    [rows]
  )

  // Gradient scales are relative to the current data set, so they are computed
  // once per response, not per cell.
  const bounds = useMemo(() => verificationGradientBounds(rows), [rows])

  const columns: Column<VerificationTableRow>[] = useMemo(
    () => [
      {
        key: 'full_name',
        header: t('pages.reports.verification.columns.employee'),
      },
      {
        key: 'group_name',
        header: t('pages.reports.verification.columns.group'),
        render: (row) => row.group_name ?? '—',
      },
      {
        key: 'numbers_added',
        header: t('pages.reports.verification.columns.numbersAdded'),
        align: 'center',
        render: (row) => (
          <GradientValue
            value={row.numbers_added}
            min={0}
            max={bounds.maxPlan}
            language={language}
          />
        ),
      },
      {
        key: 'unique_clients',
        header: t('pages.reports.verification.columns.uniqueClients'),
        align: 'center',
        render: (row) => (
          <GradientValue
            value={row.unique_clients}
            min={bounds.minClients}
            max={bounds.maxClients}
            language={language}
          />
        ),
      },
      {
        key: 'month_plan',
        header: t('pages.reports.verification.columns.monthPlan'),
        align: 'center',
        render: (row) => (
          <span className="tabular-nums">
            {formatNumber(row.month_plan, language, PLAN_NUMBER_OPTIONS)}
          </span>
        ),
      },
      {
        key: 'month_plan_diff',
        header: t('pages.reports.verification.columns.monthPlanDiff'),
        align: 'center',
        render: (row) => <PlanDiffValue value={row.month_plan_diff} language={language} />,
      },
    ],
    [t, language, bounds.maxPlan, bounds.minClients, bounds.maxClients]
  )

  return (
    <DataTable
      columns={columns}
      data={data}
      emptyMessage={t('pages.reports.verification.empty')}
      className="w-full"
    />
  )
}
