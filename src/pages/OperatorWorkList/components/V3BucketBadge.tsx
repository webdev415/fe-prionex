/**
 * V3 bucket badge — the five priority buckets (EXIT/LOW/AVG/HIGH/CRIT).
 * Colours use semantic status tokens so light/dark themes stay readable.
 */

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { V3Bucket } from '@/features/scoring/api/types'

const CONFIG: Record<V3Bucket, { className: string }> = {
  CRIT: {
    className: 'bg-error-50 border-error-600 text-error-700',
  },
  HIGH: {
    className: 'bg-warning-50 border-warning-500 text-warning-700',
  },
  AVG: {
    className: 'bg-primary/10 border-primary-600 text-primary-700',
  },
  LOW: {
    className: 'bg-muted border-border text-muted-foreground',
  },
  EXIT: {
    className: 'bg-muted border-muted-foreground/40 text-muted-foreground',
  },
}

export function V3BucketBadge({
  bucket,
  className,
  trailing,
}: {
  bucket: V3Bucket
  className?: string
  /**
   * Rendered inside the pill, after the label — a disclosure arrow on the
   * client card, where the badge doubles as the control for the priority
   * panel below it. A slot rather than a boolean so the badge stays a piece of
   * presentation: it knows nothing about what is being disclosed, and the four
   * call sites that pass nothing are unaffected.
   */
  trailing?: ReactNode
}) {
  const { t } = useTranslation('common')
  const known = bucket in CONFIG ? bucket : 'LOW'
  const config = CONFIG[known]
  return (
    <span
      className={cn(
        'inline-flex h-[25px] min-w-[90px] items-center justify-center gap-1 rounded-[16px] border px-3 py-1 text-xs font-medium tracking-[-0.24px]',
        config.className,
        className
      )}
    >
      {t(`pages.scoringV3.buckets.${known}`)}
      {trailing}
    </span>
  )
}
