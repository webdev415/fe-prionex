import { describe, expect, it } from 'vitest'
import { folderToInboxApiParams } from './inboxFolderParams'

describe('folderToInboxApiParams', () => {
  it('maps inbox folder to incoming direction', () => {
    expect(folderToInboxApiParams('inbox')).toEqual({ direction: 'incoming' })
  })

  it('maps sent folder to outgoing direction alias', () => {
    expect(folderToInboxApiParams('sent')).toEqual({ direction: 'outgoing' })
  })

  it('maps quarantine folder to quarantine_only', () => {
    expect(folderToInboxApiParams('quarantine')).toEqual({ quarantine_only: true })
  })
})
