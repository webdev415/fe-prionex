export type LegalDocumentAssigneeId =
  | 'system'
  | 'emailService'
  | 'nevmerzhytska'
  | 'kostenko'
  | 'doroshenko'
  | 'melnychenko'
  | 'demchuk'
  | 'ivanenko'
  | 'bondarenko'

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
  clientName: string
  contractId: string
  action: LegalDocumentAction
  assigneeId: LegalDocumentAssigneeId
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
