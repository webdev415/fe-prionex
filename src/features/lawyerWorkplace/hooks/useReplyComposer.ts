import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { legalApi } from '../api/legalApi'
import type { LegalStagedAttachment } from '../api/types'
import { getErrorMessage } from '@/lib/errors'

export function useReplyComposerState(options: {
  messageId: string | null
  selectedMailboxId: string | null
  body: string
  enabled?: boolean
}) {
  const { t } = useTranslation('common')
  const { messageId, selectedMailboxId, body, enabled = true } = options
  const [stagedAttachments, setStagedAttachments] = useState<LegalStagedAttachment[]>([])
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const loadedMessageIdRef = useRef<string | null>(null)

  const refreshStagedAttachments = useCallback(async () => {
    if (!messageId) {
      setStagedAttachments([])
      return
    }
    try {
      const response = await legalApi.listReplyStagedAttachments(messageId)
      setStagedAttachments(response.items)
    } catch {
      setStagedAttachments([])
    }
  }, [messageId])

  useEffect(() => {
    if (!enabled || !messageId) {
      loadedMessageIdRef.current = null
      setStagedAttachments([])
      return
    }
    if (loadedMessageIdRef.current === messageId) return
    loadedMessageIdRef.current = messageId
    void refreshStagedAttachments()
  }, [enabled, messageId, refreshStagedAttachments])

  const saveDraft = useCallback(async () => {
    if (!messageId) return
    setIsSavingDraft(true)
    try {
      await legalApi.saveReplyDraft(messageId, {
        body_text: body,
        mailbox_id: selectedMailboxId,
      })
      toast.success(t('pages.lawyerWorkplace.reply.draftSaved', 'Draft saved'))
    } catch (error) {
      toast.error(getErrorMessage(error))
    } finally {
      setIsSavingDraft(false)
    }
  }, [body, messageId, selectedMailboxId, t])

  const uploadAttachment = useCallback(
    async (file: File) => {
      if (!messageId || !selectedMailboxId) {
        toast.error(t('pages.lawyerWorkplace.reply.noMailbox', 'Select a mailbox to send from'))
        return
      }
      setIsUploadingAttachment(true)
      try {
        const uploaded = await legalApi.uploadReplyStagedAttachment(
          messageId,
          selectedMailboxId,
          file
        )
        setStagedAttachments((current) => [...current, uploaded])
      } catch (error) {
        toast.error(getErrorMessage(error))
      } finally {
        setIsUploadingAttachment(false)
      }
    },
    [messageId, selectedMailboxId, t]
  )

  const removeAttachment = useCallback(
    async (attachmentId: string) => {
      if (!messageId) return
      try {
        await legalApi.deleteReplyStagedAttachment(messageId, attachmentId)
        setStagedAttachments((current) => current.filter((item) => item.id !== attachmentId))
      } catch (error) {
        toast.error(getErrorMessage(error))
      }
    },
    [messageId]
  )

  const clearComposerState = useCallback(() => {
    setStagedAttachments([])
    loadedMessageIdRef.current = null
  }, [])

  return {
    stagedAttachments,
    isSavingDraft,
    isUploadingAttachment,
    saveDraft,
    uploadAttachment,
    removeAttachment,
    clearComposerState,
    refreshStagedAttachments,
  }
}

export async function loadReplyDraftForMessage(messageId: string): Promise<{
  body: string
  mailboxId: string | null
} | null> {
  const draft = await legalApi.getReplyDraft(messageId)
  if (!draft.exists) {
    return null
  }
  return {
    body: draft.body_text,
    mailboxId: draft.mailbox_id,
  }
}
