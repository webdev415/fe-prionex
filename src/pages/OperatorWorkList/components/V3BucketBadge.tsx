/**
 * V3 bucket badge — the five priority buckets (EXIT/LOW/AVG/HIGH/CRIT).
 * Colours use semantic status tokens so light/dark themes stay readable.
 */

import { cn } from '@/lib/utils'
import type { V3Bucket } from '@/features/scoring/api/types'

const CONFIG: Record<V3Bucket, { label: string; className: string }> = {
  CRIT: {
    label: 'Call first',
    className: 'bg-error-50 border-error-600 text-error-700',
  },
  HIGH: {
    label: 'High',
    className: 'bg-warning-50 border-warning-500 text-warning-700',
  },
  AVG: {
    label: 'Average',
    className: 'bg-primary/10 border-primary-600 text-primary-700',
  },
  LOW: {
    label: 'Low',
    className: 'bg-muted border-border text-muted-foreground',
  },
  EXIT: {
    label: 'Do not call',
    className: 'bg-muted border-muted-foreground/40 text-muted-foreground',
  },
}

export function V3BucketBadge({ bucket, className }: { bucket: V3Bucket; className?: string }) {
  const config = CONFIG[bucket] ?? CONFIG.LOW
  return (
    <span
      className={cn(
        'inline-flex h-[25px] min-w-[90px] items-center justify-center rounded-[16px] border px-3 py-1 text-xs font-medium tracking-[-0.24px]',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
