import type { ReactNode } from 'react'

/**
 * Shared KPI tile used by every Action Analysis sub-tab.
 *
 * Two layouts:
 *  - Default (no `icon`) — vertical label/value with optional left accent
 *    strip (kept for Weekly Tasks day tiles and similar compact uses).
 *  - With `icon` — horizontal icon-circle + label + value, matching the
 *    Figma Interactions / Promises / Closures / Leaks / Third Parties /
 *    Time at Work / Heat Map KPI tiles.
 */
export interface AnalyticsKpiTileProps {
  label: string
  value: ReactNode
  /** Tailwind text-color class for the value (e.g. "text-emerald-600"). */
  valueTone?: string
  /** Smaller text shown beneath the value (e.g. "+5% vs last week"). */
  subValue?: ReactNode
  /** Optional left-accent strip color (used only when `icon` is absent). */
  accentColor?: string
  /** Optional icon rendered inside a colored circle on the left. */
  icon?: ReactNode
  /** Tailwind bg class for the icon circle (e.g. "bg-[#ECFDF5]"). */
  iconBg?: string
  /** Tailwind text-color class for the icon glyph (e.g. "text-[#22C55E]"). */
  iconTone?: string
}

export function AnalyticsKpiTile({
  label,
  value,
  valueTone = 'text-[#05040D]',
  subValue,
  accentColor,
  icon,
  iconBg = 'bg-[#F7F7F7]',
  iconTone = 'text-[#05040D]',
}: AnalyticsKpiTileProps) {
  if (icon) {
    // Horizontal layout — Figma "Action Analysis" KPI tile.
    return (
      <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-[#EBECE8] bg-white px-4 py-3 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconBg} ${iconTone}`}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] leading-tight font-medium text-[#676767]">{label}</span>
            {subValue ? <span className="text-[10px] text-[#9CA3AF]">{subValue}</span> : null}
          </div>
          <span className={`text-2xl leading-none font-semibold ${valueTone}`}>{value}</span>
        </div>
      </div>
    )
  }

  // Vertical layout — original compact tile.
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
