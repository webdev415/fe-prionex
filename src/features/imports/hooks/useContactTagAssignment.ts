/**
 * Hooks for the Contact Tags bulk import.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { contactTagAssignmentApi } from '../api/contactTagAssignmentApi'
import { importsApi } from '../api/importsApi'
import { importJobsKeys } from './useImportJobs'
import { getErrorMessage } from '@/lib/errors'
import type {
  ContactTagAssignmentMode,
  ContactTagExecuteRequest,
} from '../types/contactTagAssignment'

export function useContactTagAssignmentUpload() {
  return useMutation({
    mutationFn: ({
      file,
      projectId,
      mode,
    }: {
      file: File
      projectId: number
      mode: ContactTagAssignmentMode
    }) => contactTagAssignmentApi.uploadContactTagAssignment(file, projectId, mode),
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

export function useContactTagAssignmentExecute() {
  const queryClient = useQueryClient()
  const { t } = useTranslation('common')

  return useMutation({
    mutationFn: ({ jobId, request }: { jobId: number; request?: ContactTagExecuteRequest }) =>
      contactTagAssignmentApi.executeContactTagAssignment(jobId, request),
    onSuccess: () => {
      toast.success(
        t('pages.imports.contactTagAssignment.progress.jobStarted', 'Contact tag operation started')
      )
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
    },
    onError: async (error, { jobId }) => {
      toast.error(getErrorMessage(error))
      // Cancel the orphaned job so the BulkJobBanner doesn't surface it as
      // "Queued" indefinitely after a failed execute -- but only if it really is
      // orphaned. This handler also fires on a timeout or 502 for a job that
      // started fine, and cancelling that one aborts a live import at its next
      // batch boundary, leaving the file half-applied.
      try {
        await importsApi.cancelImportJob(jobId, { onlyIfNotStarted: true })
      } catch (cancelError) {
        console.error('Failed to cancel orphaned contact tag job:', cancelError)
      }
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: importJobsKeys.detail(jobId) })
    },
  })
}

/**
 * Generated client-side so it doesn't depend on backend availability, matching
 * the tag-assignment template hook. Content mirrors the backend `/template`
 * endpoint: the comment sits in the `tag` column so it aligns with that header
 * in Excel, and the doubled inner quotes are CSV escaping.
 */
export function useDownloadContactTagAssignmentTemplate() {
  return useMutation({
    mutationFn: async () => {
      const csvContent =
        ',,,"# Values must be comma-separated and all belong to the row\'s ' +
        'category, e.g. ""Telegram,WhatsApp"". Single-select categories accept ' +
        'one value only."\n' +
        'tin,contact_value,category,tag\n'
      return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'contact_tag_assignment_template.csv'
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
