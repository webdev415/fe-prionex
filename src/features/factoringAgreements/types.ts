/**
 * Types for the factoring-agreements list (backs the Bulk Document Import
 * agreement dropdown + info panel). Mirrors the client-service
 * ``FactoringAgreementResponse`` / ``FactoringAgreementPage`` schemas.
 */

export interface FactoringAgreement {
  id: number
  seller_id: number
  agreement_number: string
  previous_lender: string | null
  contract_purchase_date: string | null
  reporting_date: string | null
  created_at: string
  debt_count: number
}

export interface FactoringAgreementPage {
  items: FactoringAgreement[]
  total: number
  page: number
  page_size: number
}

export interface ListFactoringAgreementsParams {
  page?: number
  page_size?: number
  search?: string
}
