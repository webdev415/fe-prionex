import type { ReactNode } from 'react'

/**
 * Shared KPI tile used by every Action Analysis sub-tab (Weekly Tasks,
 * Promises, Closures, Leaks, Third Parties, Time at Work). Mirrors the
 * Figma "Stat tile" block — rounded white card with a small uppercase
 * label, a large value, and an optional sub-value / accent strip.
 */
export interface AnalyticsKpiTileProps {
  label: string
  value: ReactNode
  /** Tailwind text-color class for the value (e.g. "text-emerald-600"). */
  valueTone?: string
  /** Smaller text shown beneath the value (e.g. "+5% vs last week"). */
  subValue?: ReactNode
  /** Optional left-accent strip color (e.g. "bg-[#22C55E]"). */
  accentColor?: string
}

export function AnalyticsKpiTile({
  label,
  value,
  valueTone = 'text-[#05040D]',
  subValue,
  accentColor,
}: AnalyticsKpiTileProps) {
  return (
    <div className="relative flex flex-col gap-1 overflow-hidden rounded-xl border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      {accentColor ? (
        <span className={`absolute top-0 bottom-0 left-0 w-1 ${accentColor}`} aria-hidden />
      ) : null}
      <span className="text-[10px] font-medium tracking-wide text-[#676767] uppercase">
        {label}
      </span>
      <span className={`text-xl leading-tight font-semibold ${valueTone}`}>{value}</span>
      {subValue ? <span className="text-[11px] text-[#676767]">{subValue}</span> : null}
    </div>
  )
}

export default AnalyticsKpiTile
