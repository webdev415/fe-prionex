/**
 * Client Management Types
 */

export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'

export interface Client {
  id: number
  fullName: string
  /** `null` у клиента, опознанного по подтверждённому e-mail кабинета. */
  taxIdNumber: string | null
  tags: string[]
  phoneNumber: string
  dateOfSale: string
  creditor: string
  debt: string
  amountOfDebt: string
  priority: Priority
  score: number
}
