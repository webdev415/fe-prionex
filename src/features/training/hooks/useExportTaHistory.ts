import { useMutation } from '@tanstack/react-query'
import { exportTaHistory } from '../api/actionAnalysisService'
import type { TAInteractionListParams } from '@/features/taInteractions/api/types'

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

export function useExportTaHistory() {
  return useMutation({
    mutationFn: async (filters: TAInteractionListParams) => {
      const blob = await exportTaHistory(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_ta_history_${stamp}.csv`)
    },
  })
}
