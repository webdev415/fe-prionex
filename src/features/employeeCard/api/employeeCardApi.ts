import api from '@/lib/api'
import { listFiltersFromSearch } from '@/pages/UserManagement/lib/userFilterDefaults'
import type {
  AdditionalInformationUpdate,
  CardNeighbours,
  EmployeeCard,
  PersonalInformationUpdate,
  RelativeInput,
  SurveyImportReport,
  WorkInformationUpdate,
} from '../types.card'

const base = (userId: number) => `/api/v1/admin/users/${userId}/card`

export async function getEmployeeCard(
  userId: number,
  projectId?: number | null
): Promise<EmployeeCard> {
  const response = await api.get<EmployeeCard>(base(userId), {
    params: { project_id: projectId ?? undefined },
  })
  return response.data
}

export async function updatePersonal(
  userId: number,
  changes: PersonalInformationUpdate
): Promise<EmployeeCard> {
  const response = await api.patch<EmployeeCard>(`${base(userId)}/personal`, changes)
  return response.data
}

export async function updateWork(
  userId: number,
  changes: WorkInformationUpdate
): Promise<EmployeeCard> {
  const response = await api.patch<EmployeeCard>(`${base(userId)}/work`, changes)
  return response.data
}

export async function updateAdditional(
  userId: number,
  changes: AdditionalInformationUpdate
): Promise<EmployeeCard> {
  const response = await api.patch<EmployeeCard>(`${base(userId)}/additional`, changes)
  return response.data
}

export async function replaceContacts(
  userId: number,
  relatives: RelativeInput[]
): Promise<EmployeeCard> {
  const response = await api.put<EmployeeCard>(`${base(userId)}/contacts`, { relatives })
  return response.data
}

export async function updateInterviewComment(
  userId: number,
  comment: string | null
): Promise<EmployeeCard> {
  const response = await api.patch<EmployeeCard>(`${base(userId)}/interview-comment`, {
    interview_comment: comment,
  })
  return response.data
}

export async function uploadDocument(userId: number, file: File) {
  const body = new FormData()
  body.append('file', file)
  const response = await api.post(`${base(userId)}/documents`, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return response.data
}

/**
 * Load one export of survey answers.
 *
 * Not addressed to an employee, unlike everything else here: one file covers
 * whoever is in it, matched by email. That is also why it is gated on the
 * editing permission alone rather than on the manager relationship that opens
 * a single card.
 *
 * ``surveyName`` names the survey the whole file belongs to. Google Forms
 * keeps that in the form's title and never writes it into the export, so
 * without it there is nothing to call the answers.
 */
export async function importSurveys(file: File, surveyName: string): Promise<SurveyImportReport> {
  const body = new FormData()
  body.append('file', file)
  body.append('survey_name', surveyName)
  const response = await api.post<SurveyImportReport>(
    '/api/v1/admin/employee-surveys/import',
    body,
    // The shared client declares JSON for every request, and that default
    // survives a FormData body - so without saying otherwise the file goes as
    // multipart bytes labelled JSON and the server cannot read it. Naming the
    // type lets axios replace it with one carrying the boundary.
    { headers: { 'Content-Type': 'multipart/form-data' } }
  )
  return response.data
}

export async function deleteDocument(userId: number, documentId: number): Promise<void> {
  await api.delete(`${base(userId)}/documents/${documentId}`)
}

/**
 * Fetch a document as a blob so it can be saved.
 *
 * The route needs the bearer token, so a plain link cannot fetch it: the
 * browser would send an unauthenticated request and get a 401 instead of the
 * file. The same reason the avatars are fetched rather than linked.
 */
export async function downloadDocument(userId: number, documentId: number): Promise<Blob> {
  const response = await api.get(`${base(userId)}/documents/${documentId}`, {
    responseType: 'blob',
  })
  return response.data as Blob
}

/**
 * Where this employee sits in the list the reader came from.
 *
 * The list's own query string is passed straight through, so Previous and
 * Next walk the order that was on screen rather than some default one.
 */
export async function getCardNeighbours(
  userId: number,
  listQuery: string
): Promise<CardNeighbours> {
  /*
   * The card is handed the list's own URL so it can send the reader back to
   * it, but the endpoint speaks the list API's vocabulary rather than the
   * controls'. Forwarding the URL as it stands drops role, project,
   * department and group without a word, and the position comes back counted
   * over everybody instead of over what was on screen.
   */
  const filters = new URLSearchParams(
    listFiltersFromSearch(new URLSearchParams(listQuery))
  ).toString()
  const response = await api.get<CardNeighbours>(
    `${base(userId)}/neighbours${filters ? `?${filters}` : ''}`
  )
  return response.data
}
