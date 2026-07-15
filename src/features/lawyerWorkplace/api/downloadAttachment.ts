import { legalApi } from './legalApi'

export async function downloadLegalAttachment(
  messageId: string,
  attachmentId: string,
  filename: string
): Promise<void> {
  const response = await legalApi.downloadAttachment(messageId, attachmentId)
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
