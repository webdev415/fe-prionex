/**
 * Client-list summary cards, v3 version (KAN-791).
 *
 * Replaces the legacy Critical/High/Medium/Low cards once a brand is cut over.
 * Without this the same screen showed v3 buckets in the rows and legacy
 * priorities in the totals — two different scoring systems, numbers that cannot
 * be reconciled, and no way for an operator to tell which was which.
 *
 * Two deliberate differences from the legacy cards:
 *
 *   * **"Not scored" is a card, not a silent omission.** v3 only covers debts
 *     purchased inside the model's cohort, so a large share of clients have no
 *     bucket at all. Hiding them would make the cards under-count the list
 *     beneath them; showing a count nobody can explain is worse than showing it
 *     labelled.
 *   * **"Not scored" filters too.** It maps to the ``NONE`` bucket, so an
 *     operator can actually pull up the clients the model does not rank instead
 *     of only being told how many there are.
 */

import { V3BucketBadge } from '@/pages/OperatorWorkList/components/V3BucketBadge'
import type { V3Bucket, V3ClientBucketCount } from '@/features/scoring/api/types'

const ORDER: V3Bucket[] = ['CRIT', 'HIGH', 'AVG', 'LOW', 'EXIT']

const BORDER: Record<V3Bucket, string> = {
  CRIT: 'border-error-500',
  HIGH: 'border-warning-500',
  AVG: 'border-primary-600',
  LOW: 'border-border',
  EXIT: 'border-muted-foreground/40',
}

function compactMoney(n: number): string {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return Math.round(n).toString()
}

export function V3PriorityCards({
  buckets,
  counts,
  selected = [],
  onToggle,
}: {
  /** Per-bucket expected value, from the scoring service. */
  buckets: V3ClientBucketCount[]
  /**
   * Client counts for the WHOLE brand, from the client service.
   *
   * Deliberately not derived from the list: the list total reflects the active
   * filter, so a card set built from it collapses the moment one card is
   * clicked — "Not scored" went to 0 the moment any filter was applied, because
   * the filtered total no longer contained the unscored clients.
   */
  counts?: Record<string, number>
  /** Buckets currently filtering the list ("NONE" = the unscored ones). */
  selected?: string[]
  onToggle?: (bucket: string) => void
}) {
  const byBucket = new Map(buckets.map((b) => [b.bucket, b]))
  const notScored = counts?.NONE ?? null

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 xl:gap-4">
        {ORDER.map((bucket) => {
          const row = byBucket.get(bucket)
          const isSelected = selected.includes(bucket)
          return (
            <div
              key={bucket}
              role={onToggle ? 'button' : undefined}
              tabIndex={onToggle ? 0 : undefined}
              onClick={() => onToggle?.(bucket)}
              onKeyDown={(e) => {
                if (onToggle && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault()
                  onToggle(bucket)
                }
              }}
              className={`border-border bg-card flex flex-col gap-2 rounded-lg border p-3 ${BORDER[bucket]} ${
                onToggle ? 'hover:bg-muted cursor-pointer' : ''
              } ${isSelected ? 'ring-primary-400/50 shadow-sm ring-2' : ''}`}
            >
              <V3BucketBadge bucket={bucket} className="self-start" />
              <span className="text-foreground text-xl font-semibold tabular-nums">
                {(counts?.[bucket] ?? row?.clients ?? 0).toLocaleString()}
              </span>
              <span className="text-muted-foreground text-xs">
                {bucket === 'EXIT'
                  ? 'not to be called'
                  : `≈ ${compactMoney(row?.priority_dollar ?? 0)} UAH expected`}
              </span>
            </div>
          )
        })}

        {notScored != null && (
          <div
            role={onToggle ? 'button' : undefined}
            tabIndex={onToggle ? 0 : undefined}
            onClick={() => onToggle?.('NONE')}
            onKeyDown={(e) => {
              if (onToggle && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                onToggle('NONE')
              }
            }}
            className={`border-border bg-card flex flex-col gap-2 rounded-lg border border-dashed p-3 ${
              onToggle ? 'hover:bg-muted cursor-pointer' : ''
            } ${selected.includes('NONE') ? 'ring-primary-400/50 shadow-sm ring-2' : ''}`}
          >
            <span className="border-border bg-muted text-muted-foreground inline-flex h-[25px] min-w-[90px] items-center justify-center self-start rounded-[16px] border px-3 py-1 text-xs font-medium">
              Not scored
            </span>
            <span className="text-foreground text-xl font-semibold tabular-nums">
              {notScored.toLocaleString()}
            </span>
            <span className="text-muted-foreground text-xs">outside the model&apos;s range</span>
          </div>
        )}
      </div>
    </div>
  )
}
