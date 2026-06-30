import {
  getDocumentNameForType,
  DOCUMENT_ASSIGNEE_BY_ID,
  DOCUMENT_ASSIGNEE_OPTIONS,
} from '../components/documents/constants'
import type {
  LegalDocumentAction,
  LegalDocumentAssigneeId,
  LegalDocumentRow,
  LegalDocumentStats,
  LegalDocumentType,
  LegalDocumentTypeFilter,
} from './types'

/** Total mock rows shown in the documents table. */
const MOCK_DOCUMENT_COUNT = 200

export const LEGAL_DOCUMENT_STATS: LegalDocumentStats = {
  incomingCount: 148,
  incomingYearTotal: 2026,
  outgoingCount: 67,
  outgoingYearTotal: 2026,
  nbuCount: 12,
  nbuYearTotal: 2026,
  generatedPercent: 63,
}

const ASSIGNEE_IDS = DOCUMENT_ASSIGNEE_OPTIONS.map((option) => option.id)

const CLIENTS: { name: string; contractId: string }[] = [
  { name: 'I. Petrenko', contractId: 'CR-2024-00518' },
  { name: 'S. Melnyk', contractId: 'CR-2025-00201' },
  { name: 'O. Bohdanenko', contractId: 'CR-2024-00123' },
  { name: 'A. Nalivaiko', contractId: 'CR-2025-00841' },
  { name: 'V. Doroshenko', contractId: 'CR-2024-00999' },
  { name: 'N. Kovalenko', contractId: 'CR-2025-00312' },
  { name: 'M. Shevchenko', contractId: 'CR-2024-00777' },
  { name: 'T. Kravchenko', contractId: 'CR-2023-01102' },
  { name: 'H. Tkachenko', contractId: 'CR-2025-00456' },
  { name: 'P. Lysenko', contractId: 'CR-2024-00289' },
  { name: 'D. Savchenko', contractId: 'CR-2025-00601' },
  { name: 'K. Moroz', contractId: 'CR-2024-00833' },
  { name: 'R. Bondar', contractId: 'CR-2025-00147' },
  { name: 'E. Koval', contractId: 'CR-2023-01456' },
  { name: 'F. Romanenko', contractId: 'CR-2024-01002' },
  { name: 'G. Poltava', contractId: 'CR-2025-00718' },
  { name: 'J. Horbenko', contractId: 'CR-2024-00367' },
  { name: 'L. Marchenko', contractId: 'CR-2025-00944' },
]

function buildDocumentRow(
  partial: Omit<
    LegalDocumentRow,
    'nameKey' | 'nameFallback' | 'clientId' | 'assigneeUserId' | 'assigneeName' | 'filename'
  > & {
    nameIndex: number
    assigneeId: LegalDocumentAssigneeId
    clientId?: number | null
  }
): LegalDocumentRow {
  const { nameIndex, assigneeId, clientId = null, ...rest } = partial
  const name = getDocumentNameForType(rest.type, nameIndex)
  const assignee = DOCUMENT_ASSIGNEE_BY_ID[assigneeId]
  return {
    ...rest,
    clientId,
    nameKey: name.key,
    nameFallback: name.fallback,
    assigneeUserId: null,
    assigneeName: assignee?.fallback ?? assigneeId,
    filename: null,
  }
}

const SEED_DOCUMENTS: LegalDocumentRow[] = [
  buildDocumentRow({
    id: 'doc-1',
    number: 'OUT-2026-271',
    nameIndex: 0,
    type: 'outgoing',
    clientName: 'I. Petrenko',
    contractId: 'CR-2024-00518',
    action: 'generated',
    assigneeId: 'system',
    createdAt: '2026-04-27T11:43:00',
  }),
  buildDocumentRow({
    id: 'doc-2',
    number: 'OUT-2026-270',
    nameIndex: 0,
    type: 'outgoing',
    clientName: 'I. Petrenko',
    contractId: 'CR-2024-00518',
    action: 'generated',
    assigneeId: 'nevmerzhytska',
    createdAt: '2026-04-27T11:39:00',
  }),
  buildDocumentRow({
    id: 'doc-3',
    number: 'IN-2026-148',
    nameIndex: 0,
    type: 'incoming',
    clientName: 'S. Melnyk',
    contractId: 'CR-2025-00201',
    action: 'uploaded',
    assigneeId: 'nevmerzhytska',
    createdAt: '2026-06-13T10:46:00',
  }),
  buildDocumentRow({
    id: 'doc-4',
    number: 'IN-2026-147',
    nameIndex: 1,
    type: 'incoming',
    clientName: 'O. Bohdanenko',
    contractId: 'CR-2024-00123',
    action: 'uploaded',
    assigneeId: 'emailService',
    createdAt: '2026-06-13T09:31:00',
  }),
  buildDocumentRow({
    id: 'doc-5',
    number: 'OUT-2026-255',
    nameIndex: 1,
    type: 'outgoing',
    clientName: 'A. Nalivaiko',
    contractId: 'CR-2025-00841',
    action: 'generated',
    assigneeId: 'kostenko',
    createdAt: '2026-04-26T15:09:00',
  }),
  buildDocumentRow({
    id: 'doc-6',
    number: 'NBU-2026-008',
    nameIndex: 0,
    type: 'nbu_response',
    clientName: 'V. Doroshenko',
    contractId: 'CR-2024-00999',
    action: 'generated',
    assigneeId: 'doroshenko',
    createdAt: '2026-04-25T14:22:00',
  }),
  buildDocumentRow({
    id: 'doc-7',
    number: 'IN-2026-146',
    nameIndex: 2,
    type: 'incoming',
    clientName: 'N. Kovalenko',
    contractId: 'CR-2025-00312',
    action: 'uploaded',
    assigneeId: 'melnychenko',
    createdAt: '2026-06-14T08:15:00',
  }),
  buildDocumentRow({
    id: 'doc-8',
    number: 'OUT-2026-254',
    nameIndex: 2,
    type: 'outgoing',
    clientName: 'M. Shevchenko',
    contractId: 'CR-2024-00777',
    action: 'generated',
    assigneeId: 'demchuk',
    createdAt: '2026-04-24T16:55:00',
  }),
]

const TYPE_TARGETS: Record<LegalDocumentType, number> = {
  incoming: 58,
  outgoing: 122,
  nbu_response: 20,
}

function typePrefix(type: LegalDocumentType): string {
  if (type === 'incoming') return 'IN'
  if (type === 'outgoing') return 'OUT'
  return 'NBU'
}

function actionForType(type: LegalDocumentType, index: number): LegalDocumentAction {
  if (type === 'incoming') return 'uploaded'
  if (type === 'nbu_response') return index % 5 === 0 ? 'uploaded' : 'generated'
  return index % 3 === 0 ? 'uploaded' : 'generated'
}

function assigneeFor(
  type: LegalDocumentType,
  action: LegalDocumentAction,
  index: number
): LegalDocumentAssigneeId {
  if (action === 'generated' && index % 7 === 0) return 'system'
  if (type === 'incoming' && index % 4 === 0) return 'emailService'
  return ASSIGNEE_IDS[index % ASSIGNEE_IDS.length]
}

function createdAtFor(index: number): string {
  const dayOffset = index % 120
  const hour = 8 + (index % 10)
  const minute = (index * 7) % 60
  const base = new Date('2026-06-14T12:00:00')
  base.setDate(base.getDate() - dayOffset)
  base.setHours(hour, minute, 0, 0)
  return base.toISOString().slice(0, 19)
}

function interleaveTypes(types: LegalDocumentType[]): LegalDocumentType[] {
  const buckets: Record<LegalDocumentType, LegalDocumentType[]> = {
    incoming: [],
    outgoing: [],
    nbu_response: [],
  }
  for (const type of types) buckets[type].push(type)

  const result: LegalDocumentType[] = []
  const order: LegalDocumentType[] = ['incoming', 'outgoing', 'nbu_response']
  let hasMore = true
  while (hasMore) {
    hasMore = false
    for (const type of order) {
      const next = buckets[type].shift()
      if (next) {
        result.push(next)
        hasMore = true
      }
    }
  }
  return result
}

function buildTypeQueue(totalCount: number): LegalDocumentType[] {
  const seedCounts: Record<LegalDocumentType, number> = {
    incoming: 0,
    outgoing: 0,
    nbu_response: 0,
  }
  for (const doc of SEED_DOCUMENTS) seedCounts[doc.type]++

  const scale = totalCount / MOCK_DOCUMENT_COUNT
  const queue: LegalDocumentType[] = []
  for (const type of ['incoming', 'outgoing', 'nbu_response'] as LegalDocumentType[]) {
    const target = Math.round(TYPE_TARGETS[type] * scale)
    const needed = Math.max(0, target - seedCounts[type])
    for (let i = 0; i < needed; i++) queue.push(type)
  }

  return interleaveTypes(queue)
}

function generateMockLegalDocuments(totalCount: number): LegalDocumentRow[] {
  const typeQueue = buildTypeQueue(totalCount)
  const generated: LegalDocumentRow[] = []
  const typeIndex: Record<LegalDocumentType, number> = {
    incoming: 0,
    outgoing: 0,
    nbu_response: 0,
  }

  for (let i = 0; i < typeQueue.length; i++) {
    const type = typeQueue[i]
    const typeIdx = typeIndex[type]
    typeIndex[type] += 1
    const seq = SEED_DOCUMENTS.length + i + 1
    const client = CLIENTS[i % CLIENTS.length]
    const action = actionForType(type, i)
    const name = getDocumentNameForType(type, typeIdx)

    generated.push({
      id: `doc-${seq}`,
      number: `${typePrefix(type)}-2026-${String(seq).padStart(3, '0')}`,
      nameKey: name.key,
      nameFallback: name.fallback,
      type,
      clientId: null,
      clientName: client.name,
      contractId: client.contractId,
      action,
      assigneeUserId: null,
      assigneeName:
        DOCUMENT_ASSIGNEE_BY_ID[assigneeFor(type, action, i)]?.fallback ??
        assigneeFor(type, action, i),
      createdAt: createdAtFor(i),
      filename: null,
    })
  }

  return [...SEED_DOCUMENTS, ...generated].slice(0, totalCount)
}

export const MOCK_LEGAL_DOCUMENTS: LegalDocumentRow[] =
  generateMockLegalDocuments(MOCK_DOCUMENT_COUNT)

function countDocuments(filter: LegalDocumentTypeFilter): number {
  if (filter === 'all') return MOCK_LEGAL_DOCUMENTS.length
  if (filter === 'uploaded') {
    return MOCK_LEGAL_DOCUMENTS.filter((doc) => doc.action === 'uploaded').length
  }
  if (filter === 'generated') {
    return MOCK_LEGAL_DOCUMENTS.filter((doc) => doc.action === 'generated').length
  }
  return MOCK_LEGAL_DOCUMENTS.filter((doc) => doc.type === filter).length
}

export const DOCUMENT_FILTER_COUNTS = {
  all: countDocuments('all'),
  incoming: countDocuments('incoming'),
  outgoing: countDocuments('outgoing'),
  nbu_response: countDocuments('nbu_response'),
  uploaded: countDocuments('uploaded'),
  generated: countDocuments('generated'),
} as const
