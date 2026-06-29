/** Hooks for the Bulk Sale Notes Import feature. */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { saleNotesApi } from '../api/saleNotesApi'
import { importsApi } from '../api/importsApi'
import { importJobsKeys } from './useImportJobs'
import { getErrorMessage } from '@/lib/errors'

export function useSaleNotesUpload() {
  return useMutation({
    mutationFn: ({ file, projectId }: { file: File; projectId: number }) =>
      saleNotesApi.uploadSaleNotes(file, projectId),
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useSaleNotesExecute() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')

  return useMutation({
    mutationFn: ({ jobId }: { jobId: number }) => saleNotesApi.executeSaleNotes(jobId),
    onSuccess: () => {
      toast.success(t('pages.imports.saleNotes.progress.jobStarted', 'Sale notes import started'))
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
    },
    onError: async (error, { jobId }) => {
      toast.error(getErrorMessage(error))
      try {
        await importsApi.cancelImportJob(jobId)
      } catch (cancelError) {
        console.error('Failed to cancel orphaned sale notes job:', cancelError)
      }
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: importJobsKeys.detail(jobId) })
    },
  })
}

export function useDownloadSaleNotesTemplate() {
  return useMutation({
    mutationFn: () => saleNotesApi.downloadSaleNotesTemplate(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'sale_notes_template.csv'
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
