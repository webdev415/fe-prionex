import api from '@/lib/api'
import type {
  LegalInboxParams,
  LegalInboxResponse,
  LegalKanbanResponse,
  LegalKanbanTaskCreateRequest,
  LegalKanbanTaskCreateResponse,
  LegalLawyer,
  LegalLawyerCreate,
  LegalLawyerListResponse,
  LegalLawyerUpdate,
  LegalMailboxListResponse,
  LegalLetterConfirmRequest,
  LegalLetterConfirmResponse,
  LegalMessageSuggestionsPatchRequest,
  LegalMessageSuggestionsPatchResponse,
  LegalLawyerSuggestion,
  LegalLetterType,
  LegalLetterTypeCreate,
  LegalLetterTypeListResponse,
  LegalLetterTypePrioritiesUpdate,
  LegalLetterTypeUpdate,
  LegalDocumentListParams,
  LegalDocumentListResponse,
  LegalDocumentResponse,
  LegalDocumentStatsResponse,
  LegalGenerateDocumentRequest,
  LegalMessageDetail,
  LegalOutgoingLetterRequest,
  LegalOutgoingLetterResponse,
  LegalThreadDetail,
  LegalThreadReplyRequest,
  LegalThreadReplyResponse,
  LegalTrainingExample,
  LegalTrainingExampleCreate,
  LegalTrainingExampleUpdate,
  LegalClientContractListResponse,
  LegalClientSearchResponse,
  LegalContractPatchRequest,
  LegalContractPatchResponse,
  LegalDepartmentSyncSettings,
  LegalDepartmentSyncSettingsUpdate,
  LegalMailboxCreate,
  LegalMailboxConnectionTest,
  LegalMailboxConnectionTestResponse,
  LegalMailboxUpdate,
  LegalPollAllMailboxesResponse,
  LegalReplyTemplate,
  LegalReplyTemplateCreate,
  LegalReplyTemplateListResponse,
  LegalReplyTemplateUpdate,
  LegalReplyDraft,
  LegalReplyDraftUpsert,
  LegalStagedAttachment,
  LegalStagedAttachmentListResponse,
  LegalSettingsMailbox,
  LegalSettingsMailboxListResponse,
} from './types'

const BASE_URL = '/api/v1/legal'
const SETTINGS_URL = `${BASE_URL}/settings`
const DOCUMENTS_URL = `${BASE_URL}/documents`

export const legalApi = {
  listInbox(params: LegalInboxParams = {}) {
    return api
      .get<LegalInboxResponse>(`${BASE_URL}/inbox`, { params })
      .then((response) => response.data)
  },

  listMailboxes() {
    return api
      .get<LegalMailboxListResponse>(`${BASE_URL}/mailboxes`)
      .then((response) => response.data)
  },

  getMyLawyerProfile() {
    return api.get<LegalLawyer>(`${BASE_URL}/lawyers/me`).then((response) => response.data)
  },

  updateMyLawyerStatus(status: LegalLawyer['status']) {
    return api
      .patch<LegalLawyer>(`${BASE_URL}/lawyers/me/status`, { status })
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

  patchMessageSuggestions(messageId: string, payload: LegalMessageSuggestionsPatchRequest) {
    return api
      .patch<LegalMessageSuggestionsPatchResponse>(
        `${BASE_URL}/messages/${messageId}/suggestions`,
        payload
      )
      .then((response) => response.data)
  },

  patchMessageContract(messageId: string, payload: LegalContractPatchRequest) {
    return api
      .patch<LegalContractPatchResponse>(`${BASE_URL}/messages/${messageId}/contract`, payload)
      .then((response) => response.data)
  },

  suggestLawyerForLetterType(letterTypeId: string) {
    return api
      .get<LegalLawyerSuggestion>(`${SETTINGS_URL}/suggest-lawyer`, {
        params: { letter_type_id: letterTypeId },
      })
      .then((response) => response.data)
  },

  replyToThread(threadId: string, payload: LegalThreadReplyRequest) {
    return api
      .post<LegalThreadReplyResponse>(`${BASE_URL}/threads/${threadId}/reply`, payload)
      .then((response) => response.data)
  },

  sendOutgoingLetter(payload: LegalOutgoingLetterRequest) {
    return api
      .post<LegalOutgoingLetterResponse>(`${BASE_URL}/outgoing`, payload)
      .then((response) => response.data)
  },

  listKanban(params?: { assigned_to_user_id?: number }) {
    return api
      .get<LegalKanbanResponse>(`${BASE_URL}/kanban`, { params })
      .then((response) => response.data)
  },

  createKanbanTask(payload: LegalKanbanTaskCreateRequest) {
    return api
      .post<LegalKanbanTaskCreateResponse>(`${BASE_URL}/kanban/tasks`, payload)
      .then((response) => response.data)
  },

  patchKanbanTask(
    taskId: number,
    payload: {
      letter_type_id?: string
      client_id?: number | null
      assigned_to_user_id?: number | null
      due_date?: string | null
    }
  ) {
    return api.patch(`${BASE_URL}/kanban/tasks/${taskId}`, payload)
  },

  syncKanbanTaskStatus(taskId: number, payload: { status?: string }) {
    return api.post(`${BASE_URL}/kanban/tasks/${taskId}/sync-status`, payload)
  },

  transitionKanbanTask(
    taskId: number,
    payload: {
      target_column: 'not_defined' | 'in_progress' | 'overdue' | 'completed'
      timezone?: string
    }
  ) {
    const { timezone, ...body } = payload
    return api.post(`${BASE_URL}/kanban/tasks/${taskId}/transition`, body, {
      params: timezone ? { timezone } : undefined,
    })
  },

  listDocuments(params: LegalDocumentListParams = {}) {
    return api
      .get<LegalDocumentListResponse>(DOCUMENTS_URL, { params })
      .then((response) => response.data)
  },

  getDocumentStats(params?: { year?: number }) {
    return api
      .get<LegalDocumentStatsResponse>(`${DOCUMENTS_URL}/stats`, { params })
      .then((response) => response.data)
  },

  uploadIncomingDocument(payload: {
    file: File
    title: string
    client_id: number
    assigned_to_user_id?: number
    contract_number?: string | null
    related_letter_number?: string | null
  }) {
    const formData = new FormData()
    formData.append('file', payload.file)
    formData.append('title', payload.title)
    formData.append('client_id', String(payload.client_id))
    if (payload.assigned_to_user_id != null) {
      formData.append('assigned_to_user_id', String(payload.assigned_to_user_id))
    }
    if (payload.contract_number) {
      formData.append('contract_number', payload.contract_number)
    }
    if (payload.related_letter_number) {
      formData.append('related_letter_number', payload.related_letter_number)
    }
    return api
      .post<LegalDocumentResponse>(`${DOCUMENTS_URL}/incoming`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data)
  },

  generateDocument(payload: LegalGenerateDocumentRequest) {
    return api
      .post<LegalDocumentResponse>(`${DOCUMENTS_URL}/generate`, payload)
      .then((response) => response.data)
  },

  downloadDocument(documentId: string) {
    return api.get<Blob>(`${DOCUMENTS_URL}/${documentId}/download`, {
      responseType: 'blob',
    })
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

  listLawyers(params?: { include_inactive?: boolean; project_id?: number }) {
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

  getSyncSettings() {
    return api
      .get<LegalDepartmentSyncSettings>(`${SETTINGS_URL}/sync`)
      .then((response) => response.data)
  },

  updateSyncSettings(payload: LegalDepartmentSyncSettingsUpdate) {
    return api
      .patch<LegalDepartmentSyncSettings>(`${SETTINGS_URL}/sync`, payload)
      .then((response) => response.data)
  },

  listSettingsMailboxes() {
    return api
      .get<LegalSettingsMailboxListResponse>(`${SETTINGS_URL}/mailboxes`)
      .then((response) => response.data)
  },

  createSettingsMailbox(payload: LegalMailboxCreate) {
    return api
      .post<LegalSettingsMailbox>(`${SETTINGS_URL}/mailboxes`, payload)
      .then((response) => response.data)
  },

  updateSettingsMailbox(mailboxId: string, payload: LegalMailboxUpdate) {
    return api
      .patch<LegalSettingsMailbox>(`${SETTINGS_URL}/mailboxes/${mailboxId}`, payload)
      .then((response) => response.data)
  },

  testSettingsMailboxConnection(payload: LegalMailboxConnectionTest) {
    return api
      .post<LegalMailboxConnectionTestResponse>(
        `${SETTINGS_URL}/mailboxes/test-connection`,
        payload
      )
      .then((response) => response.data)
  },

  pollAllSettingsMailboxes() {
    // Each mailbox IMAP connect has a 15-second timeout; give the full request
    // 60 seconds so even several mailboxes can complete without a client timeout.
    return api
      .post<LegalPollAllMailboxesResponse>(`${SETTINGS_URL}/mailboxes/poll-all`, undefined, {
        timeout: 60000,
      })
      .then((response) => response.data)
  },

  listSettingsReplyTemplates(params?: { include_inactive?: boolean }) {
    return api
      .get<LegalReplyTemplateListResponse>(`${SETTINGS_URL}/reply-templates`, { params })
      .then((response) => response.data)
  },

  createSettingsReplyTemplate(payload: LegalReplyTemplateCreate) {
    return api
      .post<LegalReplyTemplate>(`${SETTINGS_URL}/reply-templates`, payload)
      .then((response) => response.data)
  },

  updateSettingsReplyTemplate(templateId: string, payload: LegalReplyTemplateUpdate) {
    return api
      .patch<LegalReplyTemplate>(`${SETTINGS_URL}/reply-templates/${templateId}`, payload)
      .then((response) => response.data)
  },

  deleteSettingsReplyTemplate(templateId: string) {
    return api.delete(`${SETTINGS_URL}/reply-templates/${templateId}`)
  },

  listComposerReplyTemplates(params?: { letter_type_id?: string }) {
    return api
      .get<LegalReplyTemplateListResponse>(`${BASE_URL}/reply-templates`, { params })
      .then((response) => response.data)
  },

  getReplyDraft(messageId: string) {
    return api
      .get<LegalReplyDraft>(`${BASE_URL}/messages/${messageId}/reply-draft`)
      .then((response) => response.data)
  },

  saveReplyDraft(messageId: string, payload: LegalReplyDraftUpsert) {
    return api
      .put<LegalReplyDraft>(`${BASE_URL}/messages/${messageId}/reply-draft`, payload)
      .then((response) => response.data)
  },

  deleteReplyDraft(messageId: string) {
    return api.delete(`${BASE_URL}/messages/${messageId}/reply-draft`)
  },

  listReplyStagedAttachments(messageId: string) {
    return api
      .get<LegalStagedAttachmentListResponse>(`${BASE_URL}/messages/${messageId}/reply-attachments`)
      .then((response) => response.data)
  },

  uploadReplyStagedAttachment(messageId: string, mailboxId: string, file: File) {
    const formData = new FormData()
    formData.append('mailbox_id', mailboxId)
    formData.append('file', file)
    return api
      .post<LegalStagedAttachment>(
        `${BASE_URL}/messages/${messageId}/reply-attachments`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      .then((response) => response.data)
  },

  deleteReplyStagedAttachment(messageId: string, attachmentId: string) {
    return api.delete(`${BASE_URL}/messages/${messageId}/reply-attachments/${attachmentId}`)
  },

  listOutgoingStagedAttachments(stagingSessionId: string) {
    return api
      .get<LegalStagedAttachmentListResponse>(`${BASE_URL}/outgoing/staging-attachments`, {
        params: { staging_session_id: stagingSessionId },
      })
      .then((response) => response.data)
  },

  uploadOutgoingStagedAttachment(stagingSessionId: string, mailboxId: string, file: File) {
    const formData = new FormData()
    formData.append('staging_session_id', stagingSessionId)
    formData.append('mailbox_id', mailboxId)
    formData.append('file', file)
    return api
      .post<LegalStagedAttachment>(`${BASE_URL}/outgoing/staging-attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data)
  },

  deleteOutgoingStagedAttachment(stagingSessionId: string, attachmentId: string) {
    return api.delete(`${BASE_URL}/outgoing/staging-attachments/${attachmentId}`, {
      params: { staging_session_id: stagingSessionId },
    })
  },

  searchClients(q: string, limit = 20) {
    return api
      .get<LegalClientSearchResponse>(`${BASE_URL}/clients/search`, {
        params: { q, limit },
      })
      .then((response) => response.data)
  },

  listClientContracts(clientId: number) {
    return api
      .get<LegalClientContractListResponse>(`${BASE_URL}/clients/${clientId}/contracts`)
      .then((response) => response.data)
  },
}

export { downloadLegalAttachment } from './downloadAttachment'
export { downloadLegalDocument } from './downloadLegalDocument'
export { exportLegalDocumentPdf, type LegalDocumentExportInput } from './exportLegalDocument'
