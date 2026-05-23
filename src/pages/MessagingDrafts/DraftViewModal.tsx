import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import type { MessagingChannel, MessagingDraft } from '@/features/messaging'
import { CHANNEL_SPECS, extractDraftVariables } from './draftModalShared'

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <div className="text-dark-500 text-sm font-light">{label}</div>
      <div className="text-dark-500 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap">
        {value || '-'}
      </div>
    </div>
  )
}

export interface DraftViewModalProps {
  draft: MessagingDraft | null
  open: boolean
  onClose: () => void
}

export function DraftViewModal({ draft, open, onClose }: DraftViewModalProps) {
  const { t } = useTranslation('common')

  const draftVariables = useMemo(() => (draft ? extractDraftVariables(draft) : []), [draft])

  const showSubject = draft
    ? (CHANNEL_SPECS[draft.channel as MessagingChannel]?.showSubject ?? false)
    : false

  return (
    <Modal open={open} onClose={onClose} maxWidth="xl">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-8 w-8 items-center justify-center rounded-full">
            <Icons.View size={18} className="text-dark-500" strokeWidth={1.5} />
          </div>
        }
        title={
          draft
            ? t('pages.messagingDrafts.view.titleWithName', {
                name: draft.name,
                defaultValue: `View draft: ${draft.name}`,
              })
            : t('pages.messagingDrafts.view.title', 'View draft')
        }
      />
      <ModalContent>
        {draft ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyField
                label={t('pages.messagingDrafts.form.name', 'Draft name')}
                value={draft.name}
              />
              <ReadOnlyField
                label={t('pages.messagingDrafts.form.channel', 'Channel')}
                value={draft.channel.toUpperCase()}
              />
              <ReadOnlyField
                label={t('pages.messagingDrafts.form.senderName', 'Sender name')}
                value={draft.sender_name || '-'}
              />
              {showSubject && (
                <ReadOnlyField
                  label={t('pages.messagingDrafts.form.subject', 'Subject')}
                  value={draft.subject || '-'}
                />
              )}
            </div>

            <ReadOnlyField
              label={t('pages.messagingDrafts.view.templateBody', 'Message template')}
              value={draft.body}
            />

            {draftVariables.length > 0 && (
              <div className="space-y-2">
                <div className="text-dark-500 text-sm font-light">
                  {t('pages.messagingDrafts.view.variables', 'Variables in this draft')}
                </div>
                <div className="flex flex-wrap gap-2">
                  {draftVariables.map((name) => (
                    <code
                      key={name}
                      className="text-dark-500 rounded-full bg-gray-100 px-2.5 py-1 text-xs"
                    >
                      {`{{${name}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose} className="w-full rounded-md">
          {t('actions.close', 'Close')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
