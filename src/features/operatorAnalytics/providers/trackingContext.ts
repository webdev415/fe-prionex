import { createContext } from 'react'
import type { AnalyticsEventType } from '../types'

export type Tracker = (
  eventType: AnalyticsEventType,
  options?: {
    callId?: string | null
    clientId?: number | null
    pageRef?: string | null
    meta?: Record<string, unknown> | null
  }
) => void

export const TrackingContext = createContext<Tracker | null>(null)
