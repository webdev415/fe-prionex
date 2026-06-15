export type LegalDocumentType = 'incoming' | 'outgoing' | 'nbu_response'

export type LegalDocumentAction = 'generated' | 'uploaded'

export type LegalDocumentTypeFilter =
  | 'all'
  | 'incoming'
  | 'outgoing'
  | 'nbu_response'
  | 'uploaded'
  | 'generated'

export interface LegalDocumentRow {
  id: string
  number: string
  name: string
  type: LegalDocumentType
  clientName: string
  contractId: string
  action: LegalDocumentAction
  assignee: string
  createdAt: string
}

export interface LegalDocumentStats {
  incomingCount: number
  incomingYearTotal: number
  outgoingCount: number
  outgoingYearTotal: number
  nbuCount: number
  nbuYearTotal: number
  generatedPercent: number
}
