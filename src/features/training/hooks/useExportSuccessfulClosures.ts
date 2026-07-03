import { useMutation } from '@tanstack/react-query'
import { exportSuccessfulClosures } from '../api/actionAnalysisService'
import type { ClosureFilters } from '../types'

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

export function useExportSuccessfulClosures() {
  return useMutation({
    mutationFn: async (filters: ClosureFilters) => {
      const blob = await exportSuccessfulClosures(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_closures_${stamp}.xlsx`)
    },
  })
}
