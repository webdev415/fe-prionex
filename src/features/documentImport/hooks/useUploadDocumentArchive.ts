/**
 * Two-phase bulk-document upload:
 *  - uploadFile(file): chunked upload + stage the ZIP (runs on file select),
 *    tracking progress 0-100.
 *  - startImport(uploadId, agreementId): bind the agreement and start
 *    processing (runs on the Start Import button). No document type: the
 *    project's bulk-upload rules type each file on their own.
 */

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { uploadArchiveInChunks, startImport as startImportApi } from '../api/documentImportApi'

export function useUploadDocumentArchive() {
  const [uploading, setUploading] = useState(false)
  const [starting, setStarting] = useState(false)
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const uploadFile = useCallback(async (file: File) => {
    const controller = new AbortController()
    abortRef.current = controller
    setUploading(true)
    setProgress(0)
    try {
      return await uploadArchiveInChunks(file, setProgress, controller.signal)
    } catch (error) {
      // A user-initiated cancel isn't a failure — swallow it silently
      // (the loop already deleted the staged file); only real errors toast.
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      toast.error(getErrorMessage(error))
      throw error
    } finally {
      setUploading(false)
      abortRef.current = null
    }
  }, [])

  // Cancel an in-flight upload: aborts the chunk loop, which deletes the
  // partial staged file on the server before rejecting with AbortError.
  const cancelUpload = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const startImport = useCallback(async (uploadId: string, agreementId: number) => {
    setStarting(true)
    try {
      return await startImportApi(uploadId, agreementId)
    } catch (error) {
      toast.error(getErrorMessage(error))
      throw error
    } finally {
      setStarting(false)
    }
  }, [])

  return { uploadFile, cancelUpload, startImport, uploading, starting, progress }
}
