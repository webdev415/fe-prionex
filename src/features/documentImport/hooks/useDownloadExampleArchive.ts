/**
 * Downloads the example ZIP archive (folder-layout guide) for bulk document
 * import. Mirrors the sale-notes template-download pattern: fetch the blob
 * from the backend, then trigger a browser download.
 */

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { documentImportApi } from '../api/documentImportApi'

export function useDownloadExampleArchive() {
  return useMutation({
    mutationFn: () => documentImportApi.downloadExampleArchive(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'example-document-archive.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
