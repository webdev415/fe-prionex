import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSidebarStore } from '@/stores/sidebarStore'
import { useLawyerWorkplaceLayout } from '../../context/lawyerWorkplaceLayout'
import type { KanbanColumnDef } from '../../kanban/kanbanData'

export const KANBAN_SCROLL_CONTAINER_ID = 'legal-kanban-scroll-container'

interface KanbanBoardScrollNavigatorProps {
  scrollContainerRef: RefObject<HTMLDivElement | null>
  columns: KanbanColumnDef[]
  className?: string
}

interface ScrollMetrics {
  hasOverflow: boolean
  thumbWidthPct: number
  thumbLeftPct: number
}

function readScrollMetrics(container: HTMLDivElement): ScrollMetrics {
  const { scrollLeft, scrollWidth, clientWidth } = container
  const maxScroll = scrollWidth - clientWidth

  if (maxScroll <= 1 || scrollWidth <= clientWidth) {
    return { hasOverflow: false, thumbWidthPct: 100, thumbLeftPct: 0 }
  }

  const thumbWidthPct = (clientWidth / scrollWidth) * 100
  const thumbLeftPct = (scrollLeft / maxScroll) * (100 - thumbWidthPct)

  return { hasOverflow: true, thumbWidthPct, thumbLeftPct }
}

export function KanbanBoardScrollNavigator({
  scrollContainerRef,
  columns,
  className,
}: KanbanBoardScrollNavigatorProps) {
  const { t } = useTranslation('common')
  const isOpenSideBar = useSidebarStore((state) => state.isOpenSideBar)
  const { showWorkspaceBanner } = useLawyerWorkplaceLayout()
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startScrollLeft: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [metrics, setMetrics] = useState<ScrollMetrics>({
    hasOverflow: false,
    thumbWidthPct: 100,
    thumbLeftPct: 0,
  })

  const syncMetrics = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    setMetrics(readScrollMetrics(container))
  }, [scrollContainerRef])

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    syncMetrics()
    container.addEventListener('scroll', syncMetrics, { passive: true })

    const ro = new ResizeObserver(syncMetrics)
    ro.observe(container)

    const inner = container.firstElementChild
    if (inner) ro.observe(inner)

    return () => {
      container.removeEventListener('scroll', syncMetrics)
      ro.disconnect()
    }
  }, [scrollContainerRef, syncMetrics, columns.length])

  const scrollToRatio = useCallback(
    (ratio: number) => {
      const container = scrollContainerRef.current
      if (!container) return
      const maxScroll = container.scrollWidth - container.clientWidth
      container.scrollLeft = Math.max(0, Math.min(ratio * maxScroll, maxScroll))
    },
    [scrollContainerRef]
  )

  const scrollToColumn = useCallback(
    (index: number) => {
      const container = scrollContainerRef.current
      if (!container) return
      const inner = container.firstElementChild
      if (!inner) return
      const columnEl = inner.children.item(index) as HTMLElement | null
      if (!columnEl) return
      container.scrollTo({ left: columnEl.offsetLeft - 16, behavior: 'smooth' })
    },
    [scrollContainerRef]
  )

  const handleTrackPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.target !== trackRef.current) return
      const track = trackRef.current
      const container = scrollContainerRef.current
      if (!track || !container) return

      const rect = track.getBoundingClientRect()
      const clickX = event.clientX - rect.left
      const thumbWidthPx = (metrics.thumbWidthPct / 100) * rect.width
      const travel = Math.max(rect.width - thumbWidthPx, 1)
      const ratio = Math.max(0, Math.min((clickX - thumbWidthPx / 2) / travel, 1))
      scrollToRatio(ratio)
    },
    [metrics.thumbWidthPct, scrollContainerRef, scrollToRatio]
  )

  const handleThumbPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
      const container = scrollContainerRef.current
      if (!container) return

      dragRef.current = { startX: event.clientX, startScrollLeft: container.scrollLeft }
      setIsDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [scrollContainerRef]
  )

  const handleThumbPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current) return
      const container = scrollContainerRef.current
      const track = trackRef.current
      if (!container || !track) return

      const maxScroll = container.scrollWidth - container.clientWidth
      if (maxScroll <= 0) return

      const trackWidth = track.getBoundingClientRect().width
      const thumbWidthPx = (metrics.thumbWidthPct / 100) * trackWidth
      const travel = Math.max(trackWidth - thumbWidthPx, 1)
      const deltaRatio = (event.clientX - dragRef.current.startX) / travel

      container.scrollLeft = Math.max(
        0,
        Math.min(dragRef.current.startScrollLeft + deltaRatio * maxScroll, maxScroll)
      )
    },
    [metrics.thumbWidthPct, scrollContainerRef]
  )

  const handleThumbPointerUp = useCallback((event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    setIsDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  if (!metrics.hasOverflow) {
    return null
  }

  return (
    <div
      className={cn(
        'pointer-events-none fixed right-0 z-30 flex justify-end px-4 transition-all duration-300 sm:px-6 lg:px-7',
        'left-0 lg:left-18',
        isOpenSideBar && 'lg:left-60',
        showWorkspaceBanner ? 'bottom-24' : 'bottom-6',
        className
      )}
    >
      <div className="flex w-full max-w-[1120px] justify-end">
        <div
          ref={trackRef}
          role="group"
          aria-label={t('pages.lawyerWorkplace.kanban.scrollNavigator', 'Scroll kanban columns')}
          className="pointer-events-auto relative h-13 w-30 cursor-pointer overflow-hidden rounded-md bg-white/95 px-1 py-1 shadow-sm"
          onPointerDown={handleTrackPointerDown}
        >
          <div className="absolute inset-1 flex items-stretch gap-1 rounded-sm">
            {columns.map((column, index) => (
              <button
                key={column.id}
                type="button"
                aria-label={t(column.labelKey, column.id.replace('_', ' '))}
                className={cn('bg-light-50 min-w-0 flex-1 rounded-[2px]')}
                onClick={(event) => {
                  event.stopPropagation()
                  scrollToColumn(index)
                }}
              />
            ))}
          </div>

          <div
            className={cn(
              'border-information-500 absolute inset-y-1 cursor-grab rounded-sm border active:cursor-grabbing',
              isDragging ? 'transition-none' : 'transition-[left,width] duration-75 ease-out'
            )}
            style={{
              width: `${metrics.thumbWidthPct}%`,
              left: `${metrics.thumbLeftPct}%`,
            }}
            onPointerDown={handleThumbPointerDown}
            onPointerMove={handleThumbPointerMove}
            onPointerUp={handleThumbPointerUp}
            onPointerCancel={handleThumbPointerUp}
          />
        </div>
      </div>
    </div>
  )
}
