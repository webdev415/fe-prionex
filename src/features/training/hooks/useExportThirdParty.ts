import { useMutation } from '@tanstack/react-query'
import { exportThirdParty } from '../api/actionAnalysisService'
import type { ThirdPartyFilters } from '../types'

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

export function useExportThirdParty() {
  return useMutation({
    mutationFn: async (filters: ThirdPartyFilters) => {
      const blob = await exportThirdParty(filters)
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      triggerDownload(blob, `action_analysis_third_parties_${stamp}.xlsx`)
    },
  })
}
