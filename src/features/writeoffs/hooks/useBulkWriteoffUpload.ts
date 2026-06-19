/**
 * React Query mutation hook for the bulk write-off CSV upload
 * (KAN-245 follow-up).
 *
 * On success, invalidates the writeoff list cache so any open
 * client-detail page sees the newly-created rows on its next render.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { AxiosError } from 'axios'

import { writeoffsBulkApi } from '../api/bulkUploadApi'
import type { BulkWriteoffHeaderError, BulkWriteoffResponse } from '../api/bulkUploadTypes'
import { writeoffKeys } from './useWriteoffs'

interface UseBulkWriteoffUploadOptions {
  /**
   * Surface the parsed 400 header-level error (missing/unrecognised
   * columns) separately so the FE can render a dedicated banner
   * instead of a generic toast.
   */
  onHeaderError?: (err: BulkWriteoffHeaderError) => void
}

export function useBulkWriteoffUpload(options?: UseBulkWriteoffUploadOptions) {
  const queryClient = useQueryClient()
  return useMutation<BulkWriteoffResponse, AxiosError, File>({
    mutationFn: (file: File) => writeoffsBulkApi.uploadWriteoffBulk(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: writeoffKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: (error) => {
      const data = error?.response?.data as
        | BulkWriteoffHeaderError
        | { detail?: BulkWriteoffHeaderError | string }
        | undefined
      const headerError =
        data && 'code' in data && data.code === 'CSV_HEADER_UNRECOGNISED'
          ? data
          : data && typeof data === 'object' && 'detail' in data
            ? typeof data.detail === 'object' &&
              data.detail &&
              'code' in data.detail &&
              data.detail.code === 'CSV_HEADER_UNRECOGNISED'
              ? (data.detail as BulkWriteoffHeaderError)
              : undefined
            : undefined

      if (headerError && options?.onHeaderError) {
        options.onHeaderError(headerError)
        return
      }
      toast.error('Bulk write-off upload failed.')
    },
  })
}
