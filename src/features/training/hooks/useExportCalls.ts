import { useMutation } from '@tanstack/react-query'
import { exportCallMonitoring } from '../api/actionAnalysisService'
import type { CallMonitoringFilters } from '../types'

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

export function useExportCalls() {
  return useMutation({
    mutationFn: async (filters: CallMonitoringFilters) => {
      const blob = await exportCallMonitoring(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_calls_${stamp}.xlsx`)
    },
  })
}
