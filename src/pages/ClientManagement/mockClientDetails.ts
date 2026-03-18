/**
 * Single mock client detail, composed from sample API responses.
 * Used by DebtSummaryPage and ActivityTimelinePage. TODO: Replace with real API.
 */

import {
  mockClientProfile,
  mockClientLoans,
  mockClientPayments,
  mockClientWritesOffs,
  mockClientPaymentsToPrimaryCreditor,
  mockClientCallSmsHistory,
  mockClientTasks,
  mockClientOperators,
  mockClientSearchers,
  mockClientDocuments,
  mockClientActivities,
} from '@/features/clients/api/mockClientDetailSamples'

export const mockClientDetail = {
  ...mockClientProfile,
  loans: mockClientLoans,
  payments: mockClientPayments,
  writesOffs: mockClientWritesOffs,
  paymentsToPrimaryCreditor: mockClientPaymentsToPrimaryCreditor,
  primaryCreditorPayments: mockClientPaymentsToPrimaryCreditor,
  callSmsHistory: mockClientCallSmsHistory,
  tasks: mockClientTasks,
  operators: mockClientOperators,
  searchers: mockClientSearchers,
  documents: mockClientDocuments,
  activities: mockClientActivities,
}
