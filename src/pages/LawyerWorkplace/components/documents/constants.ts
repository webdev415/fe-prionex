import type { TFunction } from 'i18next'
import type {
  LegalDocumentAssigneeId,
  LegalDocumentRow,
  LegalDocumentType,
  LegalDocumentTypeFilter,
} from '../../documents/types'

export interface DocumentI18nOption {
  key: string
  fallback: string
}

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
  outgoing: 'bg-[#E0F2FE] text-[#0369A1]',
  incoming: 'bg-success-100 text-success-700',
  nbu_response: 'bg-warning-100 text-warning-700',
}

export const DOCUMENT_TYPE_DOT_COLOURS: Record<LegalDocumentType, string> = {
  outgoing: 'bg-[#0369A1]',
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

export const INCOMING_DOCUMENT_NAMES: DocumentI18nOption[] = [
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.courtDecision',
    fallback: 'Copy of the decision of the District Administrative Court',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.criminalCertificate',
    fallback: 'Criminal proceedings termination certificate',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.powerOfAttorney',
    fallback: 'Power of attorney from the client',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.notarizedPassport',
    fallback: 'Notarized copy of passport',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.clientComplaint',
    fallback: 'Client complaint regarding debt collection',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.courtSummons',
    fallback: 'Court summons - civil case',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.bankruptcyRuling',
    fallback: 'Bankruptcy court ruling excerpt',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.identityVerification',
    fallback: 'Identity verification document',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.medicalCertificate',
    fallback: 'Medical certificate for deferment request',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.propertyOwnership',
    fallback: 'Property ownership certificate',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.marriageCertificate',
    fallback: 'Marriage certificate copy',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.incomeDeclaration',
    fallback: 'Income declaration from client',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.executorLetter',
    fallback: 'Executor letter from notary office',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.appealSubmission',
    fallback: 'Appeal submission from debtor',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.counterclaim',
    fallback: 'Counterclaim from opposing counsel',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.evidenceReceipts',
    fallback: 'Evidence package - payment receipts',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.debtAcknowledgment',
    fallback: 'Signed acknowledgment of debt',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.waiverLimitations',
    fallback: 'Waiver of statute of limitations',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.idCardScan',
    fallback: 'Client ID card scan',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.incoming.addressConfirmation',
    fallback: 'Registration address confirmation',
  },
]

export const OUTGOING_DOCUMENT_NAMES: DocumentI18nOption[] = [
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.autoReply',
    fallback: 'Auto-reply - IN-2026-142',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.settlementAgreement',
    fallback: 'Pre-trial settlement agreement',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.demandLetter',
    fallback: 'Demand letter - overdue payment',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.clientInquiryResponse',
    fallback: 'Response to client inquiry',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.paymentSchedule',
    fallback: 'Payment schedule proposal',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.defaultNotice',
    fallback: 'Formal notice of default',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.restructuringOffer',
    fallback: 'Debt restructuring offer',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.installmentReminder',
    fallback: 'Reminder letter - installment due',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.acknowledgmentReceived',
    fallback: 'Acknowledgment of received documents',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.rejectionSettlement',
    fallback: 'Rejection of settlement terms',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.finalDemand',
    fallback: 'Final demand before legal action',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.paymentPlanConsent',
    fallback: 'Consent to payment plan',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.accountTransferNotice',
    fallback: 'Notification of account transfer',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.attorneyRequestResponse',
    fallback: 'Response to attorney request',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.contractClarification',
    fallback: 'Clarification letter - contract terms',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.breachWarning',
    fallback: 'Written warning - breach of agreement',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.partialPaymentConfirmation',
    fallback: 'Confirmation of partial payment',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.courtHearingNotice',
    fallback: 'Notice of upcoming court hearing',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.counterclaimReply',
    fallback: 'Reply to counterclaim',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.outgoing.settlementClosure',
    fallback: 'Settlement closure letter',
  },
]

export const NBU_DOCUMENT_NAMES: DocumentI18nOption[] = [
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.creditHistoryResponse',
    fallback: 'NBU inquiry response - credit history request',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.complianceReportQ1',
    fallback: 'NBU compliance report - Q1 2026',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.creditBureauDisclosure',
    fallback: 'Credit bureau data disclosure',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.regulatoryFiling',
    fallback: 'NBU regulatory filing - collection activity',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.auditResponse',
    fallback: 'Response to NBU audit request',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.form5Pr',
    fallback: 'NBU form 5-PR submission',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.creditRegisterUpdate',
    fallback: 'Credit register update confirmation',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.borrowerVerification',
    fallback: 'NBU inquiry - borrower verification',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.annualReturn',
    fallback: 'Annual NBU statistical return',
  },
  {
    key: 'pages.lawyerWorkplace.documents.mockNames.nbu.licensingInquiry',
    fallback: 'NBU response - licensing inquiry',
  },
]

export const DOCUMENT_ASSIGNEE_OPTIONS: {
  id: LegalDocumentAssigneeId
  key: string
  fallback: string
}[] = [
  {
    id: 'system',
    key: 'pages.lawyerWorkplace.documents.assignees.system',
    fallback: 'System',
  },
  {
    id: 'emailService',
    key: 'pages.lawyerWorkplace.documents.assignees.emailService',
    fallback: 'Email Service',
  },
  {
    id: 'nevmerzhytska',
    key: 'pages.lawyerWorkplace.documents.assignees.nevmerzhytska',
    fallback: 'O. Nevmerzhytska',
  },
  {
    id: 'kostenko',
    key: 'pages.lawyerWorkplace.documents.assignees.kostenko',
    fallback: 'L. Kostenko',
  },
  {
    id: 'doroshenko',
    key: 'pages.lawyerWorkplace.documents.assignees.doroshenko',
    fallback: 'V. Doroshenko',
  },
  {
    id: 'melnychenko',
    key: 'pages.lawyerWorkplace.documents.assignees.melnychenko',
    fallback: 'S. Melnychenko',
  },
  {
    id: 'demchuk',
    key: 'pages.lawyerWorkplace.documents.assignees.demchuk',
    fallback: 'Y. Demchuk',
  },
  {
    id: 'ivanenko',
    key: 'pages.lawyerWorkplace.documents.assignees.ivanenko',
    fallback: 'M. Ivanenko',
  },
  {
    id: 'bondarenko',
    key: 'pages.lawyerWorkplace.documents.assignees.bondarenko',
    fallback: 'A. Bondarenko',
  },
]

export const DOCUMENT_ASSIGNEE_BY_ID = Object.fromEntries(
  DOCUMENT_ASSIGNEE_OPTIONS.map((option) => [option.id, option])
) as Record<LegalDocumentAssigneeId, (typeof DOCUMENT_ASSIGNEE_OPTIONS)[number]>

const DOCUMENT_NAMES_BY_TYPE: Record<LegalDocumentType, DocumentI18nOption[]> = {
  incoming: INCOMING_DOCUMENT_NAMES,
  outgoing: OUTGOING_DOCUMENT_NAMES,
  nbu_response: NBU_DOCUMENT_NAMES,
}

export function getDocumentNameForType(type: LegalDocumentType, index: number): DocumentI18nOption {
  const names = DOCUMENT_NAMES_BY_TYPE[type]
  return names[index % names.length]
}

export function getDocumentDisplayName(
  doc: Pick<LegalDocumentRow, 'nameKey' | 'nameFallback'>,
  t: TFunction
): string {
  return t(doc.nameKey, doc.nameFallback)
}

export function getDocumentAssigneeLabel(
  assigneeId: LegalDocumentAssigneeId,
  t: TFunction
): string {
  const option = DOCUMENT_ASSIGNEE_BY_ID[assigneeId]
  return t(option.key, option.fallback)
}

export function documentMatchesSearch(doc: LegalDocumentRow, query: string, t: TFunction): boolean {
  const q = query.toLowerCase().trim()
  if (!q) return true

  return (
    doc.number.toLowerCase().includes(q) ||
    getDocumentDisplayName(doc, t).toLowerCase().includes(q) ||
    doc.clientName.toLowerCase().includes(q) ||
    doc.contractId.toLowerCase().includes(q) ||
    getDocumentAssigneeLabel(doc.assigneeId, t).toLowerCase().includes(q)
  )
}
