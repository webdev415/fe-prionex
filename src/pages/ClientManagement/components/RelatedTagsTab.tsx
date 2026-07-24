/**
 * Related Tags tab — tags from linked clients with shared phone numbers.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { PermissionGuard } from '@/components/auth'
import { useHasAnyPermission } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/constants/permissions'
import { ALL_MESSAGING_SEND_PERMISSIONS } from '@/features/messaging/utils/messagingPermissions'
import { useAuthStore } from '@/stores/authStore'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import {
  isCallBlocked,
  isMessageBlocked,
  callBlockReason,
  messageBlockReason,
} from '@/features/clients/utils/contactBlocking'
import {
  useLinkedClientsRelatedTags,
  type LinkedContactInfo,
  type PhoneMeta,
} from '@/features/tags/hooks/useLinkedClientsRelatedTags'

export type { LinkedContactInfo, PhoneMeta }

interface RelatedTagsTabProps {
  clientId: number
  linkedContactsByPhone: Map<string, LinkedContactInfo[]>
  phoneMetaByNormalized: Map<string, PhoneMeta>
  includeHiddenTags?: boolean
  onCall: (phone: string, contactTypeId: number | null, spamAllowed: boolean) => void
  onSms: (phone: string) => void
  onMessage: (phone: string) => void
  onInteraction: (phone: string) => void
}

export function RelatedTagsTab({
  clientId,
  linkedContactsByPhone,
  phoneMetaByNormalized,
  includeHiddenTags = false,
  onCall,
  onSms,
  onMessage,
  onInteraction,
}: RelatedTagsTabProps) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const canSendMessaging = useHasAnyPermission(ALL_MESSAGING_SEND_PERMISSIONS)

  const { entries, isLoading } = useLinkedClientsRelatedTags(
    clientId,
    linkedContactsByPhone,
    phoneMetaByNormalized,
    { includeHidden: includeHiddenTags, enabled: !!clientId }
  )

  if (isLoading && entries.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        {t('pages.clients.detail.relatedTags.loading', 'Loading related tags...')}
      </p>
    )
  }

  if (entries.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        {t(
          'pages.clients.detail.relatedTags.empty',
          'No related tags from linked contacts with shared phone numbers.'
        )}
      </p>
    )
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 self-stretch">
      {entries.map((entry) => {
        const tagColor = entry.tag.color || '#64748b'
        const mutedFill = `${tagColor}18`

        return (
          <div
            key={entry.key}
            className="flex w-full min-w-0 flex-col gap-2 border-b border-gray-100 pb-4 last:border-b-0 last:pb-0"
          >
            <span
              className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium"
              style={{
                borderColor: tagColor,
                backgroundColor: mutedFill,
                color: tagColor,
              }}
            >
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: tagColor }}
              />
              {entry.tag.name}
            </span>

            <div className="flex flex-col gap-2 pl-0.5">
              {entry.phones.map((phone) => (
                <div
                  key={`${entry.key}-${phone.normalizedPhone}`}
                  className="flex min-w-0 items-center gap-2"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 md:gap-2">
                    <span
                      className={cn(
                        'text-dark-500 min-w-0 truncate text-xs leading-[140%] font-medium tracking-[-0.24px]',
                        phone.blocking.blocks_calls && 'line-through opacity-70'
                      )}
                    >
                      {phone.displayPhone}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 md:gap-1.5">
                      <PermissionGuard permission={PERMISSIONS.COMMUNICATION.MAKE_CALLS}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              disabled={
                                !user?.is_agent ||
                                !user?.asterisk_extension ||
                                isCallBlocked(phone.blocking)
                              }
                              onClick={() =>
                                onCall(phone.displayPhone, phone.contactTypeId, phone.spamAllowed)
                              }
                              className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 md:h-[20px] md:w-[20px]"
                            >
                              {isCallBlocked(phone.blocking) ? (
                                <Icons.Lock size={16} className="flex-shrink-0" />
                              ) : (
                                <Icons.Headset size={16} className="flex-shrink-0" />
                              )}
                            </button>
                          </TooltipTrigger>
                          {isCallBlocked(phone.blocking) && (
                            <TooltipContent>
                              {callBlockReason(phone.blocking) ||
                                t('pages.contactTags.callsBlocked', 'Calls blocked')}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </PermissionGuard>
                      <PermissionGuard permission={PERMISSIONS.COMMUNICATION.SEND_SMS}>
                        <button
                          type="button"
                          disabled={isMessageBlocked(phone.blocking)}
                          onClick={() => onSms(phone.displayPhone)}
                          className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 md:h-[20px] md:w-[20px]"
                          title={
                            isMessageBlocked(phone.blocking)
                              ? messageBlockReason(phone.blocking) ||
                                t('pages.contactTags.smsBlocked', 'SMS blocked')
                              : t('pages.clients.detail.sendSms', 'Send SMS')
                          }
                        >
                          <Icons.ChatFeedback01 size={16} className="flex-shrink-0" />
                        </button>
                      </PermissionGuard>
                      {canSendMessaging && (
                        <button
                          type="button"
                          disabled={isMessageBlocked(phone.blocking)}
                          onClick={() => onMessage(phone.displayPhone)}
                          className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 md:h-[20px] md:w-[20px]"
                          title={
                            isMessageBlocked(phone.blocking)
                              ? messageBlockReason(phone.blocking) ||
                                t('pages.contactTags.smsBlocked', 'SMS blocked')
                              : t('pages.clients.detail.sendMessage', 'Send message')
                          }
                        >
                          <Icons.Message01 size={16} className="flex-shrink-0" />
                        </button>
                      )}
                      <PermissionGuard permission={PERMISSIONS.CLIENTS.CREATE_INTERACTIONS}>
                        <button
                          type="button"
                          onClick={() => onInteraction(phone.displayPhone)}
                          className="text-primary-500 flex h-[24px] w-[24px] cursor-pointer items-center justify-center hover:opacity-80 md:h-[20px] md:w-[20px]"
                        >
                          <Icons.PencilEdit size={16} className="flex-shrink-0" />
                        </button>
                      </PermissionGuard>
                    </div>
                  </div>
                  <Link
                    to={`/dashboard/clients/${entry.linkedClient.id}`}
                    className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-[#d7ebc6] bg-[#ecf6e4] px-1.5 py-0.5 text-[10px] leading-3 font-medium text-[#519a3d] hover:border-[#c5ddb3] hover:bg-[#e3f2d8]"
                    title={t('pages.clients.detail.relatedTags.goToClient', {
                      defaultValue: 'Go to client №{{id}}',
                      id: entry.linkedClient.id,
                    })}
                  >
                    <span aria-hidden="true">🔗</span>
                    <span>{entry.linkedClient.clientNumber}</span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
