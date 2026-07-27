import type { TFunction } from 'i18next'
import type {
  LegalDocumentRow,
  LegalDocumentType,
  LegalDocumentTypeFilter,
} from '../../documents/types'

export const DOCUMENT_TYPE_FILTERS: {
  id: LegalDocumentTypeFilter
  labelKey: string
  fallback: string
}[] = [
  {
    id: 'all',
    labelKey: 'pages.lawyerWorkplace.documents.filters.allTypes',
    fallback: 'All types',
  },
  { id: 'incoming', labelKey: 'pages.lawyerWorkplace.documents.filters.incoming', fallback: 'IN' },
  { id: 'outgoing', labelKey: 'pages.lawyerWorkplace.documents.filters.outgoing', fallback: 'OUT' },
  {
    id: 'nbu_response',
    labelKey: 'pages.lawyerWorkplace.documents.filters.nbu',
    fallback: 'NBU',
  },
  {
    id: 'uploaded',
    labelKey: 'pages.lawyerWorkplace.documents.filters.uploaded',
    fallback: 'Uploaded',
  },
  {
    id: 'generated',
    labelKey: 'pages.lawyerWorkplace.documents.filters.generated',
    fallback: 'Generated',
  },
]

export const DOCUMENT_TYPE_BADGE_COLOURS: Record<LegalDocumentType, string> = {
  outgoing: 'bg-sky-100 text-sky-700',
  incoming: 'bg-success-100 text-success-700',
  nbu_response: 'bg-warning-100 text-warning-700',
}

export const DOCUMENT_TYPE_DOT_COLOURS: Record<LegalDocumentType, string> = {
  outgoing: 'bg-sky-700',
  incoming: 'bg-success-700',
  nbu_response: 'bg-warning-600',
}

export const DOCUMENT_TYPE_I18N_KEYS: Record<LegalDocumentType, string> = {
  incoming: 'pages.lawyerWorkplace.documents.types.incoming',
  outgoing: 'pages.lawyerWorkplace.documents.types.outgoing',
  nbu_response: 'pages.lawyerWorkplace.documents.types.nbuResponse',
}

export const DOCUMENT_TYPE_LABELS: Record<LegalDocumentType, string> = {
  incoming: 'Incoming',
  outgoing: 'Outgoing',
  nbu_response: 'NBU response',
}

export function getDocumentDisplayName(
  doc: Pick<LegalDocumentRow, 'nameKey' | 'nameFallback'>,
  t: TFunction
): string {
  return t(doc.nameKey, doc.nameFallback)
}

export function documentMatchesSearch(doc: LegalDocumentRow, query: string, t: TFunction): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true

  return (
    doc.number.toLowerCase().includes(q) ||
    getDocumentDisplayName(doc, t).toLowerCase().includes(q) ||
    doc.clientName.toLowerCase().includes(q) ||
    doc.contractId.toLowerCase().includes(q) ||
    doc.assigneeName.toLowerCase().includes(q)
  )
}
