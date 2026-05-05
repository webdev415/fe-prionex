import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type PropsWithChildren,
} from 'react'
import { useCallStore } from '@/stores/callStore'
import { ingestEvents, buildIngestEventsBody } from '../api/operatorAnalyticsService'
import type { AnalyticsEventType, TrackingEventPayload } from '../types'

const FLUSH_THRESHOLD = 20
const FLUSH_DEBOUNCE_MS = 5_000
const IDLE_THRESHOLD_MS = 15_000
const SESSION_STORAGE_KEY = 'analytics:session_id'

const ANALYTICS_INGEST_PATH = '/api/v1/analytics/events'

type Tracker = (
  eventType: AnalyticsEventType,
  options?: {
    callId?: string | null
    clientId?: number | null
    pageRef?: string | null
    meta?: Record<string, unknown> | null
  }
) => void

const TrackingContext = createContext<Tracker | null>(null)

function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    const existing = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (existing) return existing
    const fresh =
      typeof window.crypto?.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, fresh)
    return fresh
  } catch {
    return `s-${Date.now()}`
  }
}

function getActiveCallId(): string | null {
  const state = useCallStore.getState()
  return state.minimizedCall?.callId ?? null
}

interface TrackingProviderProps {
  enabled?: boolean
  endpoint?: string
}

export function TrackingProvider({
  enabled = true,
  endpoint = ANALYTICS_INGEST_PATH,
  children,
}: PropsWithChildren<TrackingProviderProps>) {
  const bufferRef = useRef<TrackingEventPayload[]>([])
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastActivityRef = useRef<number>(Date.now())
  const sessionIdRef = useRef<string>(getOrCreateSessionId())

  const flush = useCallback(
    async (useBeacon = false) => {
      if (!bufferRef.current.length) return
      const events = bufferRef.current.splice(0, bufferRef.current.length)

      const body = buildIngestEventsBody({ events })

      if (useBeacon && typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
        try {
          const blob = new Blob([body], { type: 'application/json' })
          navigator.sendBeacon(endpoint, blob)
          return
        } catch {
          // fall through to fetch attempt below
        }
      }

      try {
        await ingestEvents({ events })
      } catch {
        // Re-queue at the front so the buffer drives the next flush attempt.
        bufferRef.current.unshift(...events)
      }
    },
    [endpoint]
  )

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      void flush()
    }, FLUSH_DEBOUNCE_MS)
  }, [flush])

  const armIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current)
      idleTimerRef.current = null
    }
    if (!enabled) return
    if (!getActiveCallId()) return
    idleTimerRef.current = setTimeout(() => {
      idleTimerRef.current = null
      const callId = getActiveCallId()
      if (!callId) return
      const now = Date.now()
      const idleFor = now - lastActivityRef.current
      if (idleFor < IDLE_THRESHOLD_MS) return
      bufferRef.current.push({
        ts: new Date().toISOString(),
        session_id: sessionIdRef.current,
        call_id: callId,
        event_type: 'idle_detected',
        meta: { duration_ms: idleFor },
      })
      scheduleFlush()
    }, IDLE_THRESHOLD_MS + 1_000)
  }, [enabled, scheduleFlush])

  const track = useCallback<Tracker>(
    (eventType, options) => {
      if (!enabled) return
      const callId = options?.callId ?? getActiveCallId() ?? null
      bufferRef.current.push({
        ts: new Date().toISOString(),
        session_id: sessionIdRef.current,
        call_id: callId,
        client_id: options?.clientId ?? null,
        event_type: eventType,
        page_ref: options?.pageRef ?? (typeof window !== 'undefined' ? window.location.pathname : null),
        meta: options?.meta ?? null,
      })
      lastActivityRef.current = Date.now()
      armIdleTimer()
      if (bufferRef.current.length >= FLUSH_THRESHOLD) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
        void flush()
      } else {
        scheduleFlush()
      }
    },
    [enabled, armIdleTimer, flush, scheduleFlush]
  )

  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current)
          flushTimerRef.current = null
        }
        void flush(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, flush])

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const onPageHide = () => {
      void flush(true)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [enabled, flush])

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [])

  const value = useMemo(() => track, [track])

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>
}

export function useTracker(): Tracker {
  const tracker = useContext(TrackingContext)
  if (!tracker) {
    return () => {}
  }
  return tracker
}
