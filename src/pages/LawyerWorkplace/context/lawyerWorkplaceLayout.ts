import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'

/** Breakpoints based on available content width (sidebar-aware). */
export const LAWYER_LAYOUT_BREAKPOINTS = {
  /** Inbox single-pane; kanban toolbar compact mode */
  compact: 1024,
  /** Kanban 4-column grid fits comfortably */
  kanbanGrid: 1000,
  /** Inbox 3-column layout + workspace banner */
  wide: 1280,
} as const

export interface LawyerWorkplaceLayout {
  ref: RefObject<HTMLDivElement | null>
  contentWidth: number
  isCompact: boolean
  isKanbanGrid: boolean
  isWide: boolean
  showWorkspaceBanner: boolean
}

export const LawyerWorkplaceLayoutContext = createContext<LawyerWorkplaceLayout | null>(null)

export function useLawyerWorkplaceLayout(): LawyerWorkplaceLayout {
  const ctx = useContext(LawyerWorkplaceLayoutContext)
  if (!ctx) {
    throw new Error('useLawyerWorkplaceLayout must be used within LawyerWorkplaceLayoutProvider')
  }
  return ctx
}

export function useLawyerWorkplaceLayoutMeasure(): LawyerWorkplaceLayout {
  const ref = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const sync = () => setContentWidth(el.getBoundingClientRect().width)
    sync()

    const ro = new ResizeObserver(() => sync())
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return useMemo(
    () => ({
      ref,
      contentWidth,
      isCompact: contentWidth < LAWYER_LAYOUT_BREAKPOINTS.compact,
      isKanbanGrid: contentWidth >= LAWYER_LAYOUT_BREAKPOINTS.kanbanGrid,
      isWide: contentWidth >= LAWYER_LAYOUT_BREAKPOINTS.wide,
      showWorkspaceBanner: contentWidth >= LAWYER_LAYOUT_BREAKPOINTS.wide,
    }),
    [contentWidth]
  )
}
