export interface AnalyticsRadioChipItem {
  id: string
  label: string
  active?: boolean
  onClick?: () => void
}

/** Figma status radio row — lime `#80D80A` dot when active. */
export function AnalyticsRadioChips({ items }: { items: AnalyticsRadioChipItem[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className="flex items-center gap-1 transition-opacity hover:opacity-80"
        >
          <span
            className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${
              item.active ? 'border-[#80D80A]' : 'border-[#A1A1A1]'
            }`}
          >
            {item.active ? <span className="h-2.5 w-2.5 rounded-full bg-[#80D80A]" /> : null}
          </span>
          <span className="text-xs font-light tracking-[-0.02em] text-[#05040D]">{item.label}</span>
        </button>
      ))}
    </div>
  )
}

export default AnalyticsRadioChips
