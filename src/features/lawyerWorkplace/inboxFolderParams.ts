import type { IncomingFolder } from '@/pages/LawyerWorkplace/types'
import type { LegalInboxParams } from './api/types'

export function folderToInboxApiParams(
  folder: IncomingFolder
): Pick<LegalInboxParams, 'direction' | 'quarantine_only'> {
  if (folder === 'quarantine') return { quarantine_only: true }
  if (folder === 'sent') return { direction: 'outgoing' }
  return { direction: 'incoming' }
}
