/**
 * Scroll navigator of the kanban (planner story 5.3, AC1; DESIGN «Layout»:
 * eight columns of 288 px need horizontal scrolling on 1920, «навигатор
 * прокрутки уже есть в юридическом канбане CRM»).
 *
 * The same idea as the legal kanban's `KanbanBoardScrollNavigator`, which is
 * bound to the lawyer workplace layout: a miniature of the columns — each a
 * button named by its status that scrolls to it — under a frame of the part in
 * view; the frame can be dragged. Shown only when the columns overflow.
 */
import { useCallback, useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

interface BoardScrollNavigatorProps {
  scrollRef: RefObject<HTMLDivElement | null>
  columns: { id: string; name: string }[]
}

interface Metrics {
  overflow: boolean
  widthPct: number
  leftPct: number
}

function measure(container: HTMLDivElement): Metrics {
  const { scrollLeft, scrollWidth, clientWidth } = container
  const max = scrollWidth - clientWidth
  if (max <= 1) return { overflow: false, widthPct: 100, leftPct: 0 }
  const widthPct = (clientWidth / scrollWidth) * 100
  return { overflow: true, widthPct, leftPct: (scrollLeft / max) * (100 - widthPct) }
}

export function BoardScrollNavigator({ scrollRef, columns }: BoardScrollNavigatorProps) {
  const { t } = useTranslation('planner')
  const trackRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ startX: number; startLeft: number } | null>(null)
  const [metrics, setMetrics] = useState<Metrics>({ overflow: false, widthPct: 100, leftPct: 0 })

  const sync = useCallback(() => {
    const container = scrollRef.current
    if (container) setMetrics(measure(container))
  }, [scrollRef])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    sync()
    container.addEventListener('scroll', sync, { passive: true })
    const observer = new ResizeObserver(sync)
    observer.observe(container)
    return () => {
      container.removeEventListener('scroll', sync)
      observer.disconnect()
    }
  }, [scrollRef, sync, columns.length])

  const scrollToColumn = (index: number) => {
    const container = scrollRef.current
    const column = container?.children.item(index) as HTMLElement | null
    if (!container || !column) return
    if (typeof container.scrollTo === 'function') {
      // No glide for a person who asked the system for less motion (UX-DR46).
      const still =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      container.scrollTo({ left: column.offsetLeft, behavior: still ? 'auto' : 'smooth' })
    } else {
      container.scrollLeft = column.offsetLeft
    }
  }

  const onThumbDown = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current
    if (!container) return
    drag.current = { startX: event.clientX, startLeft: container.scrollLeft }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onThumbMove = (event: PointerEvent<HTMLDivElement>) => {
    const container = scrollRef.current
    const track = trackRef.current
    if (!drag.current || !container || !track) return
    const max = container.scrollWidth - container.clientWidth
    const width = track.getBoundingClientRect().width
    const travel = Math.max(width - (metrics.widthPct / 100) * width, 1)
    const left = drag.current.startLeft + ((event.clientX - drag.current.startX) / travel) * max
    container.scrollLeft = Math.max(0, Math.min(left, max))
  }
  const onThumbUp = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  if (!metrics.overflow) return null

  return (
    <div className="flex justify-end">
      <div
        ref={trackRef}
        role="group"
        aria-label={t('kanban.scrollNavigator')}
        className="bg-card border-border relative h-10 w-40 overflow-hidden rounded-md border p-1 shadow-sm"
      >
        <div className="absolute inset-1 flex items-stretch gap-0.5">
          {columns.map((column, index) => (
            <button
              key={column.id}
              type="button"
              aria-label={column.name}
              className="bg-muted hover:bg-muted-foreground/30 focus-visible:ring-ring min-w-0 flex-1 rounded-[2px] focus-visible:ring-2 focus-visible:outline-none"
              onClick={() => scrollToColumn(index)}
            />
          ))}
        </div>
        <div
          aria-hidden="true"
          data-scroll-thumb=""
          className="border-secondary-600 absolute inset-y-1 cursor-grab touch-none rounded-sm border-2 active:cursor-grabbing"
          style={{ width: `${metrics.widthPct}%`, left: `${metrics.leftPct}%` }}
          onPointerDown={onThumbDown}
          onPointerMove={onThumbMove}
          onPointerUp={onThumbUp}
          onPointerCancel={onThumbUp}
        />
      </div>
    </div>
  )
}

export default BoardScrollNavigator
