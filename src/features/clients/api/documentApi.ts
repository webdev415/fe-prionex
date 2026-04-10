import { api } from '@/lib/api'

export interface ClientDocument {
  id: number
  client_id: number
  original_filename: string
  document_type: string
  mime_type: string
  file_size: number
  source: string | null
  uploaded_by: number | null
  created_at: string
}

export const documentApi = {
  list: (clientId: number): Promise<ClientDocument[]> =>
    api.get<ClientDocument[]>(`/api/v1/clients/${clientId}/documents`).then((r) => r.data),

  upload: (clientId: number, file: File, documentType: string): Promise<ClientDocument> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('document_type', documentType)
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

  delete: (clientId: number, docId: number): Promise<void> =>
    api.delete(`/api/v1/clients/${clientId}/documents/${docId}`).then(() => undefined),
}
