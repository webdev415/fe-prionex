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
  nameKey: string
  nameFallback: string
  type: LegalDocumentType
  clientId: number | null
  clientName: string
  contractId: string
  action: LegalDocumentAction
  assigneeUserId: number | null
  assigneeName: string
  createdAt: string
  filename: string | null
  sourceMessageId: string | null
}

export interface LegalDocumentStats {
  incomingCount: number
  incomingYearTotal: number
  outgoingCount: number
  outgoingYearTotal: number
  nbuCount: number
  nbuYearTotal: number
  generatedPercent: number
  filterCounts: Record<LegalDocumentTypeFilter, number>
}
