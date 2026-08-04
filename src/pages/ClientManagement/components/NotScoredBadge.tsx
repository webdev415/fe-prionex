/**
 * "Not scored" — a client the v3 model does not cover (KAN-791).
 *
 * v3 only scores debts purchased inside the model's cohort, so a large share of
 * clients have no bucket. The first version fell back to the LEGACY priority
 * badge, which was wrong in two ways: it put two scoring systems in one column
 * with nothing to tell them apart, and it labelled compliance cases — including
 * a deceased debtor — "Critical", meaning call first.
 *
 * Credit scoring has a name for this (an "unscorable" record) and a firm rule:
 * say there is no score, never substitute one from a different model. This badge
 * is that rule.
 */

import { cn } from '@/lib/utils'

export function NotScoredBadge({ className }: { className?: string }) {
  return (
    <span
      title="This client's debts are outside the scoring model's range, so they have no priority yet."
      className={cn(
        'inline-flex h-[25px] min-w-[90px] items-center justify-center rounded-[16px] border border-dashed border-gray-300 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-500',
        className
      )}
    >
      Not scored
    </span>
  )
}
