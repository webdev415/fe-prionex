/**
 * Mock API for client detail. Returns sample JSON per call. Replace with real API later.
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
} from './mockClientDetailSamples'

export type ClientProfile = typeof mockClientProfile
export type ClientLoans = typeof mockClientLoans
export type ClientPayments = typeof mockClientPayments
export type ClientPaymentsSection = {
  payments: typeof mockClientPayments
  writesOffs: typeof mockClientWritesOffs
  paymentsToPrimaryCreditor: typeof mockClientPaymentsToPrimaryCreditor
}
export type ClientCallSmsHistory = typeof mockClientCallSmsHistory
export type ClientTasks = typeof mockClientTasks
export type ClientOperatorsSection = {
  operators: typeof mockClientOperators
  searchers: typeof mockClientSearchers
}
export type ClientDocuments = typeof mockClientDocuments
export type ClientActivities = typeof mockClientActivities

export function getMockClientProfile(_clientId: number): Promise<ClientProfile | null> {
  return Promise.resolve(mockClientProfile)
}

export function getMockClientLoans(_clientId: number): Promise<ClientLoans> {
  return Promise.resolve(mockClientLoans)
}

export function getMockClientPaymentsSection(_clientId: number): Promise<ClientPaymentsSection> {
  return Promise.resolve({
    payments: mockClientPayments,
    writesOffs: mockClientWritesOffs,
    paymentsToPrimaryCreditor: mockClientPaymentsToPrimaryCreditor,
  })
}

export function getMockClientCallSmsHistory(_clientId: number): Promise<ClientCallSmsHistory> {
  return Promise.resolve(mockClientCallSmsHistory)
}

export function getMockClientTasks(_clientId: number): Promise<ClientTasks> {
  return Promise.resolve(mockClientTasks)
}

export function getMockClientOperatorsSection(_clientId: number): Promise<ClientOperatorsSection> {
  return Promise.resolve({
    operators: mockClientOperators,
    searchers: mockClientSearchers,
  })
}

export function getMockClientDocuments(_clientId: number): Promise<ClientDocuments> {
  return Promise.resolve(mockClientDocuments)
}

export function getMockClientActivities(_clientId: number): Promise<ClientActivities> {
  return Promise.resolve(mockClientActivities)
}
