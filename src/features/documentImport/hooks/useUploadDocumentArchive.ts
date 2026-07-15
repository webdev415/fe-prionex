/**
 * Two-phase bulk-document upload:
 *  - uploadFile(file): chunked upload + stage the ZIP (runs on file select),
 *    tracking progress 0-100.
 *  - startImport(uploadId, agreementId, documentTypeId): bind the agreement +
 *    document type and start processing (runs on the Start Import button).
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { uploadArchiveInChunks, startImport as startImportApi } from '../api/documentImportApi'

export function useUploadDocumentArchive() {
  const [uploading, setUploading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [progress, setProgress] = useState(0)

  const uploadFile = useCallback(async (file: File) => {
    setUploading(true)
    setProgress(0)
    try {
      return await uploadArchiveInChunks(file, setProgress)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    } finally {
      setUploading(false)
    }
  }, [])

  const startImport = useCallback(
    async (uploadId: string, agreementId: number, documentTypeId: number) => {
      setStarting(true)
      try {
        return await startImportApi(uploadId, agreementId, documentTypeId)
      } catch (error) {
        toast.error(getErrorMessage(error))
        throw error
      } finally {
        setStarting(false)
      }
    },
    []
  )

  return { uploadFile, startImport, uploading, starting, progress }
}
