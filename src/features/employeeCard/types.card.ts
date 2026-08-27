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
  gender: string | null
  citizenship: string | null
  telegram: string | null
  city: string | null
  address: string | null
  nova_poshta_branch: string | null
  referral_source: string | null
  tax_id: string | null
  passport: string | null
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
  can_edit: boolean
}

export interface PersonalInformationUpdate {
  date_of_birth?: string | null
  gender?: string | null
  citizenship?: string | null
  tax_id?: string | null
  passport?: string | null
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
