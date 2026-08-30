/**
 * Hooks for Payment Import feature.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { paymentImportApi } from '../api/paymentImportApi'
import { importsApi } from '../api/importsApi'
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
    onError: async (error, { jobId }) => {
      toast.error(getErrorMessage(error))
      // Cancel the orphaned pending job so it doesn't linger as "Queued" in
      // any banner / history view after a failed execute.
      try {
        await importsApi.cancelImportJob(jobId, { onlyIfNotStarted: true })
      } catch (cancelError) {
        console.error('Failed to cancel orphaned payment import job:', cancelError)
      }
      queryClient.invalidateQueries({ queryKey: importJobsKeys.lists() })
      queryClient.invalidateQueries({ queryKey: importJobsKeys.detail(jobId) })
    },
  })
}

/**
 * Hook to download payment import CSV template.
 */
export function useDownloadPaymentImportTemplate() {
  return useMutation({
    mutationFn: async () => {
      const csvContent =
        'loan_number,tin,payment_amount,payment_date,payment_method,payment_type\n' +
        'КД-2024-001234,1234567890,5000.00,2026-03-10,bank_transfer,основной долг\n' +
        'LOAN-2024-005678,9876543210,2500.50,2026-03-11,cash,principal\n'
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
