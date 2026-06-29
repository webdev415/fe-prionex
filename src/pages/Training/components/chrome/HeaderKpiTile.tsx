import type { ReactElement } from 'react'
import { Icons } from '@/lib/icons'

export interface HeaderKpiTileProps {
  label: string
  value: string
  delta?: string
  icon: (props: { size?: number; className?: string }) => ReactElement
  iconColor: string
  iconBg: string
  accentColor: string
}

/** Single KPI card — Figma "Work Type" frame in style.md */
export function HeaderKpiTile({
  label,
  value,
  delta,
  icon: TileIcon,
  iconColor,
  iconBg,
  accentColor,
}: HeaderKpiTileProps) {
  return (
    <div className="relative isolate flex h-[72px] min-w-[200px] flex-1 flex-col overflow-hidden rounded-xl border border-[#EBECE8] bg-white p-4 shadow-[0px_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}
          >
            <TileIcon size={20} className={iconColor} />
          </div>
          <span className="text-sm font-medium tracking-tight text-[#545454]">{label}</span>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {delta ? (
            <span className="flex items-center gap-1 text-xs font-medium text-[#22C55E]">
              <Icons.ArrowUp size={14} className="text-[#22C55E]" />
              {delta}
            </span>
          ) : null}
          <span className="text-sm font-medium text-[#05040D]">{value}</span>
        </div>
      </div>
      <div
        className="absolute right-0 bottom-0 left-0 h-1 rounded-b-xl"
        style={{
          background: `linear-gradient(90deg, rgba(5, 4, 13, 0.3) 0%, rgba(5, 4, 13, 0) 100%), ${accentColor}`,
        }}
      />
    </div>
  )
}

export default HeaderKpiTile
