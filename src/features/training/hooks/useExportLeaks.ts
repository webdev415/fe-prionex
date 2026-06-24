import { useMutation } from '@tanstack/react-query'
import { exportLeaks } from '../api/actionAnalysisService'
import type { LeakFilters } from '../types'

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

export function useExportLeaks() {
  return useMutation({
    mutationFn: async (filters: LeakFilters) => {
      const blob = await exportLeaks(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_leaks_${stamp}.xlsx`)
    },
  })
}
