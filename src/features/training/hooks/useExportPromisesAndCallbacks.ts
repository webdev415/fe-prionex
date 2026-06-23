import { useMutation } from '@tanstack/react-query'
import { exportPromisesAndCallbacks } from '../api/actionAnalysisService'
import type { PromiseCallbackFilters } from '../types'

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

export function useExportPromisesAndCallbacks() {
  return useMutation({
    mutationFn: async (filters: PromiseCallbackFilters) => {
      const blob = await exportPromisesAndCallbacks(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_promises_${stamp}.xlsx`)
    },
  })
}
