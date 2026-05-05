import { useMutation } from '@tanstack/react-query'
import {
  exportHeatmap,
  exportScreenTime,
  exportScriptAnalytics,
  exportTimeline,
} from '../api/operatorAnalyticsService'
import type { AnalyticsRangeFilters, HeatmapFilters, TimelineQuery } from '../types'

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function timestampSuffix() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
}

export function useExportTimeline() {
  return useMutation({
    mutationFn: async (query: TimelineQuery) => {
      const blob = await exportTimeline(query)
      triggerDownload(blob, `timeline_${query.call_id}_${timestampSuffix()}.xlsx`)
    },
  })
}

export function useExportScreenTime() {
  return useMutation({
    mutationFn: async (filters: AnalyticsRangeFilters) => {
      const blob = await exportScreenTime(filters)
      triggerDownload(blob, `screen_time_${timestampSuffix()}.xlsx`)
    },
  })
}

export function useExportHeatmap() {
  return useMutation({
    mutationFn: async (filters: HeatmapFilters) => {
      const blob = await exportHeatmap(filters)
      triggerDownload(blob, `heatmap_${timestampSuffix()}.xlsx`)
    },
  })
}

export function useExportScriptAnalytics() {
  return useMutation({
    mutationFn: async (filters: AnalyticsRangeFilters) => {
      const blob = await exportScriptAnalytics(filters)
      triggerDownload(blob, `script_analytics_${timestampSuffix()}.xlsx`)
    },
  })
}
