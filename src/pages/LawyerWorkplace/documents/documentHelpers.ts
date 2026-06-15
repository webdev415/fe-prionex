import type {
  LegalDocumentAssigneeId,
  LegalDocumentRow,
  LegalDocumentStats,
  LegalDocumentType,
  LegalDocumentTypeFilter,
} from './types'

export function matchesDocumentTypeFilter(
  filter: LegalDocumentTypeFilter,
  doc: LegalDocumentRow
): boolean {
  if (filter === 'all') return true
  if (filter === 'uploaded') return doc.action === 'uploaded'
  if (filter === 'generated') return doc.action === 'generated'
  return doc.type === filter
}

export interface LegalDocumentClient {
  id: string
  name: string
  contractId: string
}

export const LEGAL_DOCUMENT_CLIENTS: LegalDocumentClient[] = [
  { id: 'cl-1', name: 'I. Petrenko', contractId: 'CR-2024-00518' },
  { id: 'cl-2', name: 'S. Melnyk', contractId: 'CR-2025-00201' },
  { id: 'cl-3', name: 'O. Bohdanenko', contractId: 'CR-2024-00123' },
  { id: 'cl-4', name: 'A. Nalivaiko', contractId: 'CR-2025-00841' },
  { id: 'cl-5', name: 'V. Doroshenko', contractId: 'CR-2024-00999' },
  { id: 'cl-6', name: 'N. Kovalenko', contractId: 'CR-2025-00312' },
  { id: 'cl-7', name: 'M. Shevchenko', contractId: 'CR-2024-00777' },
  { id: 'cl-8', name: 'T. Kravchenko', contractId: 'CR-2023-01102' },
  { id: 'cl-9', name: 'H. Tkachenko', contractId: 'CR-2025-00456' },
  { id: 'cl-10', name: 'P. Lysenko', contractId: 'CR-2024-00289' },
  { id: 'cl-11', name: 'D. Savchenko', contractId: 'CR-2025-00601' },
  { id: 'cl-12', name: 'K. Moroz', contractId: 'CR-2024-00833' },
  { id: 'cl-13', name: 'R. Bondar', contractId: 'CR-2025-00147' },
  { id: 'cl-14', name: 'E. Koval', contractId: 'CR-2023-01456' },
  { id: 'cl-15', name: 'F. Romanenko', contractId: 'CR-2024-01002' },
  { id: 'cl-16', name: 'G. Poltava', contractId: 'CR-2025-00718' },
  { id: 'cl-17', name: 'J. Horbenko', contractId: 'CR-2024-00367' },
  { id: 'cl-18', name: 'L. Marchenko', contractId: 'CR-2025-00944' },
]

export function getLegalDocumentClient(clientId: string): LegalDocumentClient | undefined {
  return LEGAL_DOCUMENT_CLIENTS.find((client) => client.id === clientId)
}

function typePrefix(type: LegalDocumentType): string {
  if (type === 'incoming') return 'IN'
  if (type === 'outgoing') return 'OUT'
  return 'NBU'
}

export function nextDocumentNumber(documents: LegalDocumentRow[], type: LegalDocumentType): string {
  const year = new Date().getFullYear()
  const prefix = typePrefix(type)
  const pattern = new RegExp(`^${prefix}-${year}-(\\d+)$`)

  const maxSeq = documents.reduce((max, doc) => {
    const match = doc.number.match(pattern)
    if (!match) return max
    return Math.max(max, parseInt(match[1] ?? '0', 10))
  }, 0)

  return `${prefix}-${year}-${String(maxSeq + 1).padStart(3, '0')}`
}

export function computeDocumentStats(documents: LegalDocumentRow[]): LegalDocumentStats {
  const year = new Date().getFullYear()
  const generatedCount = documents.filter((doc) => doc.action === 'generated').length
  const generatedPercent =
    documents.length > 0 ? Math.round((generatedCount / documents.length) * 100) : 0

  return {
    incomingCount: documents.filter((doc) => doc.type === 'incoming').length,
    incomingYearTotal: year,
    outgoingCount: documents.filter((doc) => doc.type === 'outgoing').length,
    outgoingYearTotal: year,
    nbuCount: documents.filter((doc) => doc.type === 'nbu_response').length,
    nbuYearTotal: year,
    generatedPercent,
  }
}

export function computeDocumentFilterCounts(
  documents: LegalDocumentRow[]
): Record<LegalDocumentTypeFilter, number> {
  return {
    all: documents.length,
    incoming: documents.filter((doc) => doc.type === 'incoming').length,
    outgoing: documents.filter((doc) => doc.type === 'outgoing').length,
    nbu_response: documents.filter((doc) => doc.type === 'nbu_response').length,
    uploaded: documents.filter((doc) => doc.action === 'uploaded').length,
    generated: documents.filter((doc) => doc.action === 'generated').length,
  }
}

export interface CreateGeneratedDocumentInput {
  type: 'outgoing' | 'nbu_response'
  nameKey: string
  nameFallback: string
  clientId: string
  assigneeId: LegalDocumentAssigneeId
}

export function createGeneratedDocument(
  documents: LegalDocumentRow[],
  input: CreateGeneratedDocumentInput
): LegalDocumentRow {
  const client = getLegalDocumentClient(input.clientId)
  if (!client) {
    throw new Error('Client not found')
  }

  const id = `doc-${Date.now()}`
  return {
    id,
    number: nextDocumentNumber(documents, input.type),
    nameKey: input.nameKey,
    nameFallback: input.nameFallback,
    type: input.type,
    clientName: client.name,
    contractId: client.contractId,
    action: 'generated',
    assigneeId: input.assigneeId,
    createdAt: new Date().toISOString(),
  }
}

export interface CreateIncomingDocumentInput {
  nameFallback: string
  clientId: string
  assigneeId: LegalDocumentAssigneeId
  relatedLetterNumber?: string
}

export function createIncomingDocument(
  documents: LegalDocumentRow[],
  input: CreateIncomingDocumentInput
): LegalDocumentRow {
  const client = getLegalDocumentClient(input.clientId)
  if (!client) {
    throw new Error('Client not found')
  }

  const id = `doc-${Date.now()}`
  const nameFallback =
    input.relatedLetterNumber?.trim() && !input.nameFallback.includes(input.relatedLetterNumber)
      ? `${input.nameFallback} (${input.relatedLetterNumber.trim()})`
      : input.nameFallback

  return {
    id,
    number: nextDocumentNumber(documents, 'incoming'),
    nameKey: `custom:${id}`,
    nameFallback,
    type: 'incoming',
    clientName: client.name,
    contractId: client.contractId,
    action: 'uploaded',
    assigneeId: input.assigneeId,
    createdAt: new Date().toISOString(),
  }
}
