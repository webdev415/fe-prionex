/**
 * V3 bucket badge — the five priority buckets (EXIT/LOW/AVG/HIGH/CRIT).
 */

import { cn } from '@/lib/utils'
import type { V3Bucket } from '@/features/scoring/api/types'

const CONFIG: Record<V3Bucket, { label: string; className: string }> = {
  CRIT: { label: 'Call first', className: 'bg-[#FCEAEA] border-error-600 text-error-600' },
  HIGH: { label: 'High', className: 'bg-[#FFF6E6] border-[#FF9D00] text-[#B36F00]' },
  AVG: { label: 'Average', className: 'bg-[#F0F7E6] border-primary-600 text-primary-600' },
  LOW: { label: 'Low', className: 'bg-[#F8F8F8] border-gray-200 text-gray-500' },
  EXIT: { label: 'Do not call', className: 'bg-[#ECECEC] border-gray-400 text-gray-600' },
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
