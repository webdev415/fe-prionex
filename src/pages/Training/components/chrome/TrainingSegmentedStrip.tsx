import { Icons } from '@/lib/icons'

export interface SegmentedStripItem {
  id: string
  label: string
  count?: number
}

interface TrainingSegmentedStripProps {
  items: SegmentedStripItem[]
  activeId: string
  onChange: (id: string) => void
  /** Team-style filter chips show a close icon on the active item. */
  showActiveClose?: boolean
}

/** Figma "CTAs" segmented control — white tray, #204E4D active pill, optional count badges. */
export function TrainingSegmentedStrip({
  items,
  activeId,
  onChange,
  showActiveClose = false,
}: TrainingSegmentedStripProps) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-lg border border-[#EBECE8] bg-white p-1 shadow-[0px_1px_2px_rgba(0,0,0,0.06),0px_1px_3px_rgba(0,0,0,0.1)]">
      {items.map((item) => {
        const isActive = item.id === activeId
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex items-center gap-1 rounded-md px-4 py-2 text-xs font-medium tracking-[-0.02em] transition-colors ${
              isActive ? 'bg-[#204E4D] text-white' : 'text-[#05040D] hover:bg-[#F7F7F7]'
            }`}
          >
            {item.label}
            {item.count != null ? (
              <span
                className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1.5 text-[10px] font-medium ${
                  isActive ? 'bg-[#BBFB5B] text-[#05040D]' : 'bg-[#EDEDED] text-[#676767]'
                }`}
              >
                {item.count}
              </span>
            ) : null}
            {showActiveClose && isActive ? <Icons.Close size={12} className="text-white" /> : null}
          </button>
        )
      })}
    </div>
  )
}

export default TrainingSegmentedStrip
