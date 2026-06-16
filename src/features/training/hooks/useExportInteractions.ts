import { useMutation } from '@tanstack/react-query'
import { exportInteractionMonitoring } from '../api/actionAnalysisService'
import type { InteractionMonitoringFilters } from '../types'

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

export function useExportInteractions() {
  return useMutation({
    mutationFn: async (filters: InteractionMonitoringFilters) => {
      const blob = await exportInteractionMonitoring(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_interactions_${stamp}.xlsx`)
    },
  })
}
