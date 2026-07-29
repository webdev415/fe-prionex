import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import type { LetterTypeConfig, MailboxRoutingRule, SettingsMailbox } from '../../../settings/types'
import { createRoutingRule, sortRoutingRules } from '../../../settings/utils/mailboxHelpers'
import { RoutingRulesTable, type RoutingRuleDraft } from './RoutingRulesTable'

interface RoutingRulesPanelProps {
  mailboxes: SettingsMailbox[]
  letterTypes: LetterTypeConfig[]
  onSaveRoutingRules: (mailboxId: string, rules: MailboxRoutingRule[]) => Promise<void>
  isSaving: boolean
  readOnly?: boolean
}

export function RoutingRulesPanel({
  mailboxes,
  letterTypes,
  onSaveRoutingRules,
  isSaving,
  readOnly = false,
}: RoutingRulesPanelProps) {
  const { t } = useTranslation('common')
  const [selectedMailboxId, setSelectedMailboxId] = useState('')

  const selectedMailbox = useMemo(() => {
    if (mailboxes.length === 0) return null
    return mailboxes.find((mailbox) => mailbox.id === selectedMailboxId) ?? mailboxes[0]!
  }, [mailboxes, selectedMailboxId])

  const rules = useMemo(
    () => (selectedMailbox ? sortRoutingRules(selectedMailbox.routingRules) : []),
    [selectedMailbox]
  )

  const save = async (nextRules: MailboxRoutingRule[]) => {
    if (!selectedMailbox) return
    try {
      await onSaveRoutingRules(selectedMailbox.id, nextRules)
    } catch {
      // mutation toast handles errors; react-query re-syncs on next fetch
    }
  }

  const handleToggle = (rule: MailboxRoutingRule) =>
    save(rules.map((item) => (item.id === rule.id ? { ...item, isActive: !item.isActive } : item)))

  const handleDelete = (rule: MailboxRoutingRule) =>
    save(rules.filter((item) => item.id !== rule.id))

  const handleChangeLetterType = (rule: MailboxRoutingRule, letterTypeId: string) => {
    if (rule.letterTypeId === letterTypeId) return
    save(rules.map((item) => (item.id === rule.id ? { ...item, letterTypeId } : item)))
  }

  const handleAdd = (draft: RoutingRuleDraft) => {
    const rule = createRoutingRule(draft.letterTypeId, draft.matchType, draft.value, draft.isActive)
    save([...rules, rule])
  }

  return (
    <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
      <div className="border-border bg-card text-muted-foreground flex items-start gap-2.5 rounded-lg border px-4 py-3 text-[12px] leading-relaxed">
        <Icons.Info size={16} strokeWidth={1.5} className="text-primary-500 mt-0.5 shrink-0" />
        <span>
          {t(
            'pages.lawyerWorkplace.settings.routing.explanation',
            'Rules decide the letter type by sender domain or a word in the subject. Priority: domain → subject → letter-type keywords → default.'
          )}
        </span>
      </div>

      {mailboxes.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center rounded-xl border px-6 py-14 text-center">
          <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.Mail size={22} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <p className="text-foreground text-[14px] font-medium">
            {t(
              'pages.lawyerWorkplace.settings.routing.noMailboxes.title',
              'No mailboxes connected'
            )}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.routing.noMailboxes.description',
              'Connect a mailbox in the Mailboxes tab before adding identification rules.'
            )}
          </p>
        </div>
      ) : (
        <>
          {mailboxes.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-foreground text-[13px] font-medium">
                {t('pages.lawyerWorkplace.settings.routing.mailbox', 'Mailbox')}
              </label>
              <select
                aria-label={t('pages.lawyerWorkplace.settings.routing.mailbox', 'Mailbox')}
                value={selectedMailbox?.id ?? ''}
                onChange={(e) => setSelectedMailboxId(e.target.value)}
                className="text-foreground focus:border-primary-400 border-border bg-input h-10 max-w-md rounded-md border px-3 text-[13px] outline-none"
              >
                {mailboxes.map((mailbox) => (
                  <option key={mailbox.id} value={mailbox.id}>
                    {mailbox.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <RoutingRulesTable
            rules={rules}
            letterTypes={letterTypes}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onChangeLetterType={handleChangeLetterType}
            onAdd={handleAdd}
            isSaving={isSaving}
            readOnly={readOnly}
          />
        </>
      )}
    </div>
  )
}
