import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Label } from '@/components/ui/Label'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { LetterTypeConfig, MailboxRoutingRule, SettingsMailbox } from '../../../settings/types'
import { createRoutingRule } from '../../../settings/utils/mailboxHelpers'
import { ROUTING_MATCH_OPTIONS } from '../constants'
import { LetterTypeBadge } from '../LetterTypeBadge'

export interface MailboxFormValues {
  email: string
  displayName: string
  defaultLetterTypeId: string | null
  isDefaultOutgoing: boolean
  routingRules: MailboxRoutingRule[]
}

interface MailboxModalProps {
  open: boolean
  mailbox: SettingsMailbox | null
  letterTypes: LetterTypeConfig[]
  existingEmails: string[]
  onClose: () => void
  onSave: (values: MailboxFormValues) => void
}

function getInitialValues(
  mailbox: SettingsMailbox | null,
  t: (key: string, fallback: string) => string
): MailboxFormValues {
  if (!mailbox) {
    return {
      email: '',
      displayName: '',
      defaultLetterTypeId: null,
      isDefaultOutgoing: false,
      routingRules: [],
    }
  }

  return {
    email: mailbox.email,
    displayName: t(mailbox.displayNameKey, mailbox.displayNameFallback),
    defaultLetterTypeId: mailbox.defaultLetterTypeId,
    isDefaultOutgoing: mailbox.isDefaultOutgoing,
    routingRules: mailbox.routingRules.map((rule) => ({ ...rule })),
  }
}

export function MailboxModal({
  open,
  mailbox,
  letterTypes,
  existingEmails,
  onClose,
  onSave,
}: MailboxModalProps) {
  const { t } = useTranslation('common')
  const isEditing = mailbox !== null

  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [defaultLetterTypeId, setDefaultLetterTypeId] = useState<string | null>(null)
  const [isDefaultOutgoing, setIsDefaultOutgoing] = useState(false)
  const [routingRules, setRoutingRules] = useState<MailboxRoutingRule[]>([])

  const [newMatchType, setNewMatchType] =
    useState<MailboxRoutingRule['matchType']>('subject_keyword')
  const [newMatchValue, setNewMatchValue] = useState('')
  const [newRuleTypeId, setNewRuleTypeId] = useState('')

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      const initial = getInitialValues(mailbox, t)
      setEmail(initial.email)
      setDisplayName(initial.displayName)
      setDefaultLetterTypeId(initial.defaultLetterTypeId)
      setIsDefaultOutgoing(initial.isDefaultOutgoing)
      setRoutingRules(initial.routingRules)
      setNewMatchType('subject_keyword')
      setNewMatchValue('')
      setNewRuleTypeId(letterTypes[0]?.id ?? '')
    })
  }, [open, mailbox, t, letterTypes])

  const duplicateEmail = useMemo(() => {
    const normalized = email.trim().toLowerCase()
    if (!normalized) return false
    return existingEmails.some(
      (item) =>
        item.toLowerCase() === normalized && item.toLowerCase() !== mailbox?.email.toLowerCase()
    )
  }, [email, existingEmails, mailbox?.email])

  const canSave =
    email.trim().length > 0 &&
    displayName.trim().length > 0 &&
    !duplicateEmail &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  const handleAddRule = () => {
    if (!newRuleTypeId) return
    if (newMatchType !== 'default' && !newMatchValue.trim()) return

    const rule = createRoutingRule(newRuleTypeId, newMatchType, newMatchValue)
    setRoutingRules((previous) => [...previous, rule])
    setNewMatchValue('')
  }

  const handleRemoveRule = (ruleId: string) => {
    setRoutingRules((previous) => previous.filter((rule) => rule.id !== ruleId))
  }

  const handleSave = () => {
    if (!canSave) return
    onSave({
      email: email.trim(),
      displayName: displayName.trim(),
      defaultLetterTypeId,
      isDefaultOutgoing,
      routingRules,
    })
  }

  const selectedDefaultType = letterTypes.find((type) => type.id === defaultLetterTypeId)

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="bg-primary-300 flex h-10 w-10 items-center justify-center rounded-full">
            <Icons.Mail size={20} strokeWidth={1.5} className="text-dark-500" />
          </div>
        }
        title={
          isEditing
            ? t('pages.lawyerWorkplace.settings.mailboxes.editTitle', 'Edit mailbox')
            : t('pages.lawyerWorkplace.settings.mailboxes.addTitle', 'Add mailbox')
        }
      />
      <ModalContent className="flex max-h-[60vh] flex-col gap-5 overflow-y-auto px-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-[13px] font-medium">
              {t('pages.lawyerWorkplace.settings.mailboxes.fields.email', 'Email address')}
            </Label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="legal@prionex.ua"
              className="text-dark-500 focus:border-primary-400 h-11 rounded-md border border-gray-200 bg-white px-4 text-[14px] outline-none"
            />
            {duplicateEmail ? (
              <p className="text-error-600 text-[11px]">
                {t(
                  'pages.lawyerWorkplace.settings.mailboxes.duplicateEmail',
                  'This mailbox is already connected'
                )}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label className="text-dark-500 text-[13px] font-medium">
              {t('pages.lawyerWorkplace.settings.mailboxes.fields.displayName', 'Display name')}
            </Label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t(
                'pages.lawyerWorkplace.settings.mailboxes.fields.displayNamePlaceholder',
                'Legal department'
              )}
              className="text-dark-500 focus:border-primary-400 h-11 rounded-md border border-gray-200 bg-white px-4 text-[14px] outline-none"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label className="text-dark-500 text-[13px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.fields.defaultType',
              'Default letter type'
            )}
          </Label>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-dark-500 flex h-11 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-4 text-[14px]"
              >
                <span className={cn(!selectedDefaultType && 'text-gray-400')}>
                  {selectedDefaultType ? (
                    <LetterTypeBadge letterType={selectedDefaultType} t={t} size="sm" />
                  ) : (
                    t('pages.lawyerWorkplace.settings.mailboxes.autoRoute', 'Auto-route')
                  )}
                </span>
                <Icons.ArrowDown size={16} strokeWidth={1.5} className="text-light-500" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="max-h-60 min-w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto p-1.5"
            >
              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => setDefaultLetterTypeId(null)}
              >
                {t('pages.lawyerWorkplace.settings.mailboxes.autoRoute', 'Auto-route')}
              </DropdownMenuItem>
              {letterTypes.map((type) => (
                <DropdownMenuItem
                  key={type.id}
                  className="cursor-pointer"
                  onClick={() => setDefaultLetterTypeId(type.id)}
                >
                  <LetterTypeBadge letterType={type} t={t} size="sm" />
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={isDefaultOutgoing}
            onChange={(e) => setIsDefaultOutgoing(e.target.checked)}
            className="accent-secondary-800 h-4 w-4 rounded border-gray-300"
          />
          <span className="text-dark-500 text-[13px]">
            {t(
              'pages.lawyerWorkplace.settings.mailboxes.fields.defaultOutgoing',
              'Use as default outgoing mailbox in reply composer'
            )}
          </span>
        </label>

        <div className="space-y-3">
          <div>
            <h3 className="text-dark-500 text-[13px] font-semibold">
              {t('pages.lawyerWorkplace.settings.mailboxes.routing.title', 'Routing rules')}
            </h3>
            <p className="text-light-600 mt-0.5 text-[11px]">
              {t(
                'pages.lawyerWorkplace.settings.mailboxes.routing.hint',
                'Map incoming messages to letter types by sender or subject'
              )}
            </p>
          </div>

          <div className="space-y-2">
            {routingRules.map((rule) => {
              const letterType = letterTypes.find((type) => type.id === rule.letterTypeId)
              const matchLabel = ROUTING_MATCH_OPTIONS.find((item) => item.id === rule.matchType)
              return (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center gap-2 rounded-md bg-white px-3 py-1.5"
                >
                  <span className="text-light-600 text-[11px] font-medium">
                    {matchLabel ? t(matchLabel.labelKey, matchLabel.fallback) : rule.matchType}
                  </span>
                  {rule.matchType !== 'default' ? (
                    <span className="text-dark-500 text-[12px]">“{rule.value}”</span>
                  ) : null}
                  <Icons.ArrowRight02 size={12} className="text-light-400" strokeWidth={1.5} />
                  {letterType ? <LetterTypeBadge letterType={letterType} t={t} size="sm" /> : null}
                  <button
                    type="button"
                    onClick={() => handleRemoveRule(rule.id)}
                    className="text-light-500 hover:text-dark-500 ml-auto"
                    aria-label={t('actions.remove', 'Remove')}
                  >
                    <Icons.Cancel01 size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex flex-col gap-2 rounded-md border border-dashed border-gray-200 p-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label className="text-light-600 text-[11px]">
                {t('pages.lawyerWorkplace.settings.mailboxes.routing.matchType', 'Match')}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[12px]"
                  >
                    {t(
                      ROUTING_MATCH_OPTIONS.find((item) => item.id === newMatchType)?.labelKey ??
                        '',
                      ROUTING_MATCH_OPTIONS.find((item) => item.id === newMatchType)?.fallback ??
                        newMatchType
                    )}
                    <Icons.ArrowDown size={14} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {ROUTING_MATCH_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.id}
                      className="cursor-pointer"
                      onClick={() => setNewMatchType(option.id)}
                    >
                      {t(option.labelKey, option.fallback)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {newMatchType !== 'default' ? (
              <div className="min-w-[140px] flex-1 space-y-1">
                <Label className="text-light-600 text-[11px]">
                  {t('pages.lawyerWorkplace.settings.mailboxes.routing.value', 'Value')}
                </Label>
                <input
                  type="text"
                  value={newMatchValue}
                  onChange={(e) => setNewMatchValue(e.target.value)}
                  placeholder={newMatchType === 'sender_domain' ? 'court.gov.ua' : 'complaint'}
                  className="text-dark-500 h-10 w-full rounded-md border border-gray-200 bg-white px-3 text-[12px] outline-none"
                />
              </div>
            ) : null}
            <div className="min-w-[140px] flex-1 space-y-1">
              <Label className="text-light-600 text-[11px]">
                {t('pages.lawyerWorkplace.settings.mailboxes.routing.letterType', 'Letter type')}
              </Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="text-dark-500 flex h-10 w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 text-[12px]"
                  >
                    <span className="truncate">
                      {letterTypes.find((type) => type.id === newRuleTypeId)?.nameFallback ??
                        t(
                          'pages.lawyerWorkplace.settings.mailboxes.routing.selectType',
                          'Select type'
                        )}
                    </span>
                    <Icons.ArrowDown size={14} strokeWidth={1.5} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-48 overflow-y-auto">
                  {letterTypes.map((type) => (
                    <DropdownMenuItem
                      key={type.id}
                      className="cursor-pointer"
                      onClick={() => setNewRuleTypeId(type.id)}
                    >
                      <LetterTypeBadge letterType={type} t={t} size="sm" />
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button variant="outline" size="sm" className="h-10 rounded-md" onClick={handleAddRule}>
              {t('pages.lawyerWorkplace.settings.mailboxes.routing.addRule', 'Add rule')}
            </Button>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button variant="cancel" onClick={onClose} className="h-10 w-full rounded-md">
          {t('actions.cancel', 'Cancel')}
        </Button>
        <Button
          variant="primary"
          disabled={!canSave}
          onClick={handleSave}
          className="h-10 w-full rounded-md"
        >
          {isEditing ? t('actions.save', 'Save') : t('actions.add', 'Add')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
