/**
 * The employee card as the API returns it.
 *
 * One read carries every section this service owns. Feedback and grades come
 * from the quality service and are fetched separately, so an outage there
 * costs two panels rather than the page.
 */

export interface CardHeader {
  id: number
  full_name: string
  last_name: string
  first_name: string
  middle_name: string | null
  status: string
  work_format: string | null
  avatar_url: string | null
  phone: string | null
  email: string | null
  position: string | null
  department: string | null
  manager: string | null
  manager_user_id: number | null
  hired_at: string | null
  telegram: string | null
}

export interface PersonalInformation {
  date_of_birth: string | null
  telegram: string | null
  city: string | null
  address: string | null
  nova_poshta_branch: string | null
  referral_source: string | null
}

export interface WorkInformation {
  project_id: number | null
  project_name: string | null
  department: string | null
  department_id: number | null
  position: string | null
  role_id: number | null
  manager: string | null
  hired_at: string | null
  asterisk_extension: string | null
  dialer_extension: string | null
}

export interface Relative {
  id: number
  kind: 'contact' | 'child'
  full_name: string
  relation: string | null
  phone: string | null
  date_of_birth: string | null
}

export interface Education {
  id: number
  level: string | null
  institution: string | null
  faculty: string | null
  speciality: string | null
  graduation_year: number | null
}

export interface Language {
  id: number
  language: string
  level: string | null
}

export interface AdditionalInformation {
  military_status: string | null
  visa_status: string | null
  educations: Education[]
  languages: Language[]
}

export interface EmployeeDocument {
  id: number
  kind: string
  original_filename: string
  content_type: string
  size_bytes: number
  uploaded_at: string
}

export interface EmployeeSurvey {
  id: number
  name: string
  completed_on: string | null
  status: string
  score: number | null
  max_score: number | null
  details_url: string | null
}

export interface EmployeeCard {
  header: CardHeader
  personal: PersonalInformation
  work: WorkInformation
  contacts: Relative[]
  children: Relative[]
  additional: AdditionalInformation
  documents: EmployeeDocument[]
  surveys: EmployeeSurvey[]
  interview_comment: string | null
  /**
   * Present only once somebody has left. Its presence is what makes the card
   * read-only - the page does not infer that from a status, and the server
   * refuses the writes regardless.
   */
  termination: Termination | null
  can_edit: boolean
}

export interface PersonalInformationUpdate {
  last_name?: string | null
  first_name?: string | null
  middle_name?: string | null
  date_of_birth?: string | null
  phone?: string | null
  email?: string | null
  work_format?: string
  telegram?: string | null
  city?: string | null
  address?: string | null
  nova_poshta_branch?: string | null
  referral_source?: string | null
}

export interface WorkInformationUpdate {
  project_id?: number
  role_id?: number
  department_id?: number
  manager_user_id?: number | null
  hired_at?: string | null
  /** Null clears one, which is a different request from leaving it out. */
  asterisk_extension?: string | null
  dialer_extension?: string | null
}

export interface RelativeInput {
  kind: 'contact' | 'child'
  full_name: string
  relation?: string | null
  phone?: string | null
  date_of_birth?: string | null
}

export interface AdditionalInformationUpdate {
  military_status?: string | null
  visa_status?: string | null
  educations?: Array<Omit<Education, 'id'>>
  languages?: Array<Omit<Language, 'id'>>
}

export interface CardNeighbours {
  position: number | null
  total: number
  previous_user_id: number | null
  next_user_id: number | null
}

/** One row an import would not load, and why. */
export interface RefusedSurveyRow {
  row: number
  email: string | null
  reason: string
}

/**
 * What an import did, and what it would not do.
 *
 * The refused rows carry their line number so a file can be corrected rather
 * than a missing survey noticed months later - which is the whole reason the
 * endpoint returns them, and why this screen has to show them.
 */
export interface SurveyImportReport {
  created: number
  updated: number
  refused: number
  rows: RefusedSurveyRow[]
}

/** One survey answer, as somebody records it on the card. */
export interface SurveyInput {
  name: string
  completed_on?: string | null
  score?: number | null
  max_score?: number | null
  status: 'completed' | 'pending'
  details_url?: string | null
}

/** Why somebody left, in the words the card offers. */
export const TERMINATION_REASONS = [
  'personal_desire',
  'dismissed',
  'end_of_contract',
  'redundancy',
  'other',
] as const

export type TerminationReason = (typeof TERMINATION_REASONS)[number]

export interface Termination {
  terminated_on: string
  reason: string
  comment: string | null
}

export interface TerminationInput {
  terminated_on: string
  reason: TerminationReason
  comment?: string | null
}
