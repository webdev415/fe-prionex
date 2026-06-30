import { legalApi } from './legalApi'

export async function downloadLegalDocument(documentId: string, filename: string): Promise<void> {
  const response = await legalApi.downloadDocument(documentId)
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
