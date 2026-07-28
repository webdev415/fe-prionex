import i18n from '@/lib/i18n'
import type { Client } from '@/features/clients/api/types'
import type { LegalDocumentListItem, LegalDocumentStatsResponse, LegalLawyer } from './types'
import type {
  LegalDocumentAction,
  LegalDocumentRow,
  LegalDocumentStats,
  LegalDocumentType,
} from '@/pages/LawyerWorkplace/documents/types'

export interface LegalDocumentLookup {
  clientsById: Map<number, Client>
  lawyersByUserId: Map<number, LegalLawyer>
}

function resolveDocumentType(value: string): LegalDocumentType {
  if (value === 'incoming' || value === 'outgoing' || value === 'nbu_response') {
    return value
  }
  return 'incoming'
}

function resolveDocumentAction(value: string): LegalDocumentAction {
  // Pass known actions through; anything unexpected keeps the legacy
  // "generated" fallback so an unknown server value never crashes the table.
  if (value === 'uploaded' || value === 'received' || value === 'synced') {
    return value
  }
  return 'generated'
}

function resolveClientName(clientId: number | null, lookup: LegalDocumentLookup): string {
  if (clientId == null) return '—'
  const client = lookup.clientsById.get(clientId)
  if (!client) {
    return i18n.t('pages.lawyerWorkplace.documents.unknownClient', {
      defaultValue: 'Client #{{id}}',
      id: clientId,
    })
  }
  const code = `CL-${String(client.id).padStart(5, '0')}`
  const name = [client.first_name, client.middle_name, client.last_name].filter(Boolean).join(' ')
  return name ? `${code} · ${name}` : code
}

function resolveContractId(
  _clientId: number | null,
  contractNumber: string | null,
  _lookup: LegalDocumentLookup
): string {
  if (contractNumber?.trim()) return contractNumber.trim()
  return '—'
}

function resolveAssigneeName(userId: number | null, lookup: LegalDocumentLookup): string {
  if (userId == null) return '—'
  const lawyer = lookup.lawyersByUserId.get(userId)
  return (
    lawyer?.display_name ??
    i18n.t('pages.lawyerWorkplace.documents.unknownUser', {
      defaultValue: 'User #{{id}}',
      id: userId,
    })
  )
}

export function mapLegalDocumentItem(
  item: LegalDocumentListItem,
  lookup: LegalDocumentLookup
): LegalDocumentRow {
  return {
    id: item.id,
    number: item.number,
    nameKey: `legal-document:${item.id}`,
    nameFallback: item.title,
    type: resolveDocumentType(item.document_type),
    clientId: item.client_id,
    clientName: resolveClientName(item.client_id, lookup),
    contractId: resolveContractId(item.client_id, item.contract_number, lookup),
    action: resolveDocumentAction(item.action),
    assigneeUserId: item.assigned_to_user_id,
    assigneeName: resolveAssigneeName(item.assigned_to_user_id, lookup),
    createdAt: item.created_at,
    filename: item.filename,
    sourceMessageId: item.source_message_id ?? null,
  }
}

export function mapLegalDocumentStats(stats: LegalDocumentStatsResponse): LegalDocumentStats {
  const filterCounts = stats.filter_counts ?? {}
  return {
    incomingCount: stats.incoming_count,
    incomingYearTotal: stats.incoming_year_total,
    outgoingCount: stats.outgoing_count,
    outgoingYearTotal: stats.outgoing_year_total,
    nbuCount: stats.nbu_count,
    nbuYearTotal: stats.nbu_year_total,
    generatedPercent: stats.generated_percent,
    filterCounts: {
      all: filterCounts.all ?? 0,
      incoming: filterCounts.incoming ?? 0,
      outgoing: filterCounts.outgoing ?? 0,
      nbu_response: filterCounts.nbu_response ?? 0,
      uploaded: filterCounts.uploaded ?? 0,
      generated: filterCounts.generated ?? 0,
    },
  }
}

export function buildLegalDocumentLookup(
  clients: Client[],
  lawyers: LegalLawyer[]
): LegalDocumentLookup {
  return {
    clientsById: new Map(clients.map((client) => [client.id, client])),
    lawyersByUserId: new Map(lawyers.map((lawyer) => [lawyer.user_id, lawyer])),
  }
}
