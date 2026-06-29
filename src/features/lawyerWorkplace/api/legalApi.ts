import api from '@/lib/api'
import type {
  LegalInboxParams,
  LegalInboxResponse,
  LegalLawyer,
  LegalLawyerCreate,
  LegalLawyerListResponse,
  LegalLawyerUpdate,
  LegalLetterConfirmRequest,
  LegalLetterConfirmResponse,
  LegalLetterType,
  LegalLetterTypeCreate,
  LegalLetterTypeListResponse,
  LegalLetterTypePrioritiesUpdate,
  LegalLetterTypeUpdate,
  LegalMessageDetail,
  LegalThreadDetail,
  LegalThreadReplyRequest,
  LegalThreadReplyResponse,
  LegalTrainingExample,
  LegalTrainingExampleCreate,
  LegalTrainingExampleUpdate,
} from './types'

const BASE_URL = '/api/v1/legal'
const SETTINGS_URL = `${BASE_URL}/settings`

export const legalApi = {
  listInbox(params: LegalInboxParams = {}) {
    return api
      .get<LegalInboxResponse>(`${BASE_URL}/inbox`, { params })
      .then((response) => response.data)
  },

  getMessage(messageId: string) {
    return api
      .get<LegalMessageDetail>(`${BASE_URL}/messages/${messageId}`)
      .then((response) => response.data)
  },

  getThread(threadId: string, params?: { include_quarantined?: boolean }) {
    return api
      .get<LegalThreadDetail>(`${BASE_URL}/threads/${threadId}`, { params })
      .then((response) => response.data)
  },

  confirmLetter(messageId: string, payload: LegalLetterConfirmRequest) {
    return api
      .post<LegalLetterConfirmResponse>(`${BASE_URL}/letters/${messageId}/confirm`, payload)
      .then((response) => response.data)
  },

  replyToThread(threadId: string, payload: LegalThreadReplyRequest) {
    return api
      .post<LegalThreadReplyResponse>(`${BASE_URL}/threads/${threadId}/reply`, payload)
      .then((response) => response.data)
  },

  downloadAttachment(messageId: string, attachmentId: string) {
    return api.get<Blob>(`${BASE_URL}/messages/${messageId}/attachments/${attachmentId}/download`, {
      responseType: 'blob',
    })
  },

  listLetterTypes(params?: { include_inactive?: boolean }) {
    return api
      .get<LegalLetterTypeListResponse>(`${SETTINGS_URL}/letter-types`, { params })
      .then((response) => response.data)
  },

  getLetterType(letterTypeId: string) {
    return api
      .get<LegalLetterType>(`${SETTINGS_URL}/letter-types/${letterTypeId}`)
      .then((response) => response.data)
  },

  createLetterType(payload: LegalLetterTypeCreate) {
    return api
      .post<LegalLetterType>(`${SETTINGS_URL}/letter-types`, payload)
      .then((response) => response.data)
  },

  updateLetterType(letterTypeId: string, payload: LegalLetterTypeUpdate) {
    return api
      .patch<LegalLetterType>(`${SETTINGS_URL}/letter-types/${letterTypeId}`, payload)
      .then((response) => response.data)
  },

  archiveLetterType(letterTypeId: string) {
    return api.delete(`${SETTINGS_URL}/letter-types/${letterTypeId}`)
  },

  replaceLetterTypePriorities(letterTypeId: string, payload: LegalLetterTypePrioritiesUpdate) {
    return api
      .put<LegalLetterType>(`${SETTINGS_URL}/letter-types/${letterTypeId}/priorities`, payload)
      .then((response) => response.data)
  },

  listTrainingExamples(letterTypeId: string) {
    return api
      .get<{
        items: LegalTrainingExample[]
        total: number
      }>(`${SETTINGS_URL}/letter-types/${letterTypeId}/examples`)
      .then((response) => response.data)
  },

  createTrainingExample(letterTypeId: string, payload: LegalTrainingExampleCreate) {
    return api
      .post<LegalTrainingExample>(`${SETTINGS_URL}/letter-types/${letterTypeId}/examples`, payload)
      .then((response) => response.data)
  },

  updateTrainingExample(
    letterTypeId: string,
    exampleId: string,
    payload: LegalTrainingExampleUpdate
  ) {
    return api
      .patch<LegalTrainingExample>(
        `${SETTINGS_URL}/letter-types/${letterTypeId}/examples/${exampleId}`,
        payload
      )
      .then((response) => response.data)
  },

  deleteTrainingExample(letterTypeId: string, exampleId: string) {
    return api.delete(`${SETTINGS_URL}/letter-types/${letterTypeId}/examples/${exampleId}`)
  },

  listLawyers(params?: { include_inactive?: boolean }) {
    return api
      .get<LegalLawyerListResponse>(`${SETTINGS_URL}/lawyers`, { params })
      .then((response) => response.data)
  },

  getLawyer(lawyerId: string) {
    return api
      .get<LegalLawyer>(`${SETTINGS_URL}/lawyers/${lawyerId}`)
      .then((response) => response.data)
  },

  createLawyer(payload: LegalLawyerCreate) {
    return api
      .post<LegalLawyer>(`${SETTINGS_URL}/lawyers`, payload)
      .then((response) => response.data)
  },

  updateLawyer(lawyerId: string, payload: LegalLawyerUpdate) {
    return api
      .patch<LegalLawyer>(`${SETTINGS_URL}/lawyers/${lawyerId}`, payload)
      .then((response) => response.data)
  },

  archiveLawyer(lawyerId: string) {
    return api.delete(`${SETTINGS_URL}/lawyers/${lawyerId}`)
  },
}
