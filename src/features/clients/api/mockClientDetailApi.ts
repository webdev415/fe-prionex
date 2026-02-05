/**
 * Mock API for client detail sections not yet backed by real API.
 */

import { mockClientDocuments } from './mockClientDetailSamples'

export type ClientDocuments = typeof mockClientDocuments

export function getMockClientDocuments(_clientId: number): Promise<ClientDocuments> {
  return Promise.resolve(mockClientDocuments)
}
