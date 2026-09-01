/**
 * Hooks for the Bulk Tag Assignment / Removal feature.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { tagAssignmentApi } from '../api/tagAssignmentApi'
import { importsApi } from '../api/importsApi'
import { importJobsKeys } from './useImportJobs'
import { getErrorMessage } from '@/lib/errors'
import type { TagAssignmentMode, TagExecuteRequest } from '../types/tagAssignment'

export function useTagAssignmentUpload() {
  return useMutation({
    mutationFn: ({
      file,
      projectId,
      mode,
    }: {
      file: File
      projectId: number
      mode: TagAssignmentMode
    }) => tagAssignmentApi.uploadTagAssignment(file, projectId, mode),
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useTagAssignmentExecute() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')

  return useMutation({
    mutationFn: ({ jobId, request }: { jobId: number; request?: TagExecuteRequest }) =>
      tagAssignmentApi.executeTagAssignment(jobId, request),
    onSuccess: () => {
      toast.success(t('pages.imports.tagAssignment.progress.jobStarted', 'Tag operation started'))
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
    },
    onError: async (error, { jobId }) => {
      toast.error(getErrorMessage(error))
      // Cancel the orphaned pending job so the BulkJobBanner doesn't surface
      // it as "Queued" indefinitely after a failed execute.
      try {
        await importsApi.cancelImportJob(jobId, { onlyIfNotStarted: true })
      } catch (cancelError) {
        console.error('Failed to cancel orphaned tag assignment job:', cancelError)
      }
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: importJobsKeys.detail(jobId) })
    },
  })
}

/**
 * Generates the template client-side so it doesn't depend on backend availability.
 */
export function useDownloadTagAssignmentTemplate() {
  return useMutation({
    mutationFn: async () => {
      // Comment hint goes in column B so it aligns with the `tags` header
      // when the operator opens the template in Excel/Sheets. The doubled
      // inner quotes are CSV escaping for the literal "tag1,tag2,…".
      const csvContent =
        ',"# Tags must be separated by comma. e.g. ""tag1,tag2,tag3,tag4"""\n' + 'tax_id,tags\n'
      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'tag_assignment_template.csv'
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
