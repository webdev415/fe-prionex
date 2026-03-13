/**
 * Hooks for Payment Import feature.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentImportApi } from '../api/paymentImportApi'
import { importJobsKeys } from './useImportJobs'
import { getErrorMessage } from '@/lib/errors'
import type { PaymentImportExecuteRequest } from '../types/paymentImport'

/**
 * Hook to upload payment import CSV and get preview.
 */
export function usePaymentImportUpload() {
  return useMutation({
    mutationFn: ({ file, projectId }: { file: File; projectId: number }) =>
      paymentImportApi.uploadPaymentImport(file, projectId),
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to execute a validated payment import job.
 */
export function usePaymentImportExecute() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ jobId, request }: { jobId: number; request?: PaymentImportExecuteRequest }) =>
      paymentImportApi.executePaymentImport(jobId, request),
    onSuccess: () => {
      toast.success('Payment import job started')
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}

/**
 * Hook to download payment import CSV template.
 */
export function useDownloadPaymentImportTemplate() {
  return useMutation({
    mutationFn: async () => {
      const csvContent = 'loan_number,payment_amount,payment_date,payment_method,payment_type\n'
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      return blob
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'payment_import_template.csv'
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
