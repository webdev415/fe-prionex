import { api } from '@/lib/api'

/** Embedded type reference on every document row — see BE DocumentTypeRef. */
export interface DocumentTypeRef {
  id: number
  name: string
  color: string
}

export interface ClientDocument {
  id: number
  client_id: number
  debt_id: number | null
  original_filename: string
  document_type_id: number | null
  document_type_ref: DocumentTypeRef | null
  mime_type: string
  file_size: number
  source: string | null
  uploaded_by: number | null
  created_at: string
}

export const documentApi = {
  list: (clientId: number): Promise<ClientDocument[]> =>
    api.get<ClientDocument[]>(`/api/v1/clients/${clientId}/documents`).then((r) => r.data),

  upload: (
    clientId: number,
    file: File,
    documentTypeId: number,
    debtId?: number | null
  ): Promise<ClientDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type_id', String(documentTypeId))
    if (debtId != null) {
      formData.append('debt_id', String(debtId))
    }
    return api
      .post<ClientDocument>(`/api/v1/clients/${clientId}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  download: async (clientId: number, docId: number, filename: string): Promise<void> => {
    const response = await api.get(`/api/v1/clients/${clientId}/documents/${docId}`, {
      responseType: 'blob',
    })
    const url = URL.createObjectURL(response.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  },

  // Same endpoint as `download` — the bytes are identical and only the caller's
  // use of them differs. `inline` is what tells the audit trail apart: viewing a
  // file and saving a copy of it are different acts when it holds personal data.
  preview: async (clientId: number, docId: number): Promise<Blob> => {
    const response = await api.get(`/api/v1/clients/${clientId}/documents/${docId}`, {
      params: { inline: true },
      responseType: 'blob',
    })
    return response.data as Blob
  },

  patch: (
    clientId: number,
    docId: number,
    data: { debt_id: number | null }
  ): Promise<ClientDocument> =>
    api
      .patch<ClientDocument>(`/api/v1/clients/${clientId}/documents/${docId}`, data)
      .then((r) => r.data),

  delete: (clientId: number, docId: number): Promise<void> =>
    api.delete(`/api/v1/clients/${clientId}/documents/${docId}`).then(() => undefined),
}
