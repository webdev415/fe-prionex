import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { useLawyerWorkplaceLayout } from '../../../context/lawyerWorkplaceLayout'
import type {
  LetterTypeConfig,
  MailboxRoutingRule,
  RoutingMatchType,
} from '../../../settings/types'
import { MOVE_TO_WORKING_VALUE, ROUTING_MATCH_OPTIONS } from '../constants'
import { LetterTypeDot } from '../LetterTypeDot'

export interface RoutingRuleDraft {
  matchType: RoutingMatchType
  value: string
  letterTypeId: string
  isActive: boolean
}

interface RoutingRulesTableProps {
  rules: MailboxRoutingRule[]
  letterTypes: LetterTypeConfig[]
  onToggle: (rule: MailboxRoutingRule) => void
  onDelete: (rule: MailboxRoutingRule) => void
  onChangeLetterType: (rule: MailboxRoutingRule, letterTypeId: string) => void
  onAdd: (draft: RoutingRuleDraft) => void
  isSaving?: boolean
  readOnly?: boolean
}

const selectTriggerClass = 'h-9 rounded-md text-[13px]'
const inputClass =
  'text-foreground focus:border-primary-400 border-border bg-input h-9 rounded-md border px-3 text-[13px] outline-none'

// The fallback ("default") rule routes unmatched mail to the standard
// "нестандартне звернення" letter type; no dedicated type is created for it.
const DEFAULT_RULE_LETTER_TYPE_ID = 'nestandartne_zvernennia'

export function RoutingRulesTable({
  rules,
  letterTypes,
  onToggle,
  onDelete,
  onChangeLetterType,
  onAdd,
  isSaving = false,
  readOnly = false,
}: RoutingRulesTableProps) {
  const { t } = useTranslation('common')
  const { isCompact } = useLawyerWorkplaceLayout()
  const [adding, setAdding] = useState(false)
  const [draftMatchType, setDraftMatchType] = useState<RoutingMatchType>('sender_domain')
  const [draftValue, setDraftValue] = useState('')
  const [draftLetterTypeId, setDraftLetterTypeId] = useState('')
  const [draftActive, setDraftActive] = useState(true)

  const letterTypeById = useMemo(
    () => Object.fromEntries(letterTypes.map((type) => [type.id, type])),
    [letterTypes]
  )
  const selectableLetterTypes = useMemo(
    () => letterTypes.filter((type) => type.isActive),
    [letterTypes]
  )

  const matchLabel = (matchType: RoutingMatchType) => {
    const option = ROUTING_MATCH_OPTIONS.find((item) => item.id === matchType)
    return option ? t(option.labelKey, option.fallback) : matchType
  }

  const letterTypeOptions = (currentId: string) => {
    // Keep an assigned-but-archived type visible so the row never loses its target.
    const current = letterTypeById[currentId]
    if (current && !current.isActive) {
      return [current, ...selectableLetterTypes]
    }
    return selectableLetterTypes
  }

  const resetDraft = () => {
    setDraftMatchType('sender_domain')
    setDraftValue('')
    setDraftLetterTypeId('')
    setDraftActive(true)
  }

  const openAdd = () => {
    resetDraft()
    setDraftLetterTypeId(selectableLetterTypes[0]?.id ?? '')
    setAdding(true)
  }

  const closeAdd = () => {
    setAdding(false)
    resetDraft()
  }

  const handleDraftMatchTypeChange = (next: RoutingMatchType) => {
    setDraftMatchType(next)
    // Steer the fallback rule toward the standard "нестандартне звернення" type.
    if (next === 'default' && letterTypeById[DEFAULT_RULE_LETTER_TYPE_ID]?.isActive) {
      setDraftLetterTypeId(DEFAULT_RULE_LETTER_TYPE_ID)
    }
  }

  const draftNeedsValue = draftMatchType !== 'default'
  const canSubmitDraft =
    draftLetterTypeId.length > 0 && (!draftNeedsValue || draftValue.trim().length > 0)

  const submitDraft = () => {
    if (!canSubmitDraft || isSaving) return
    onAdd({
      matchType: draftMatchType,
      value: draftNeedsValue ? draftValue.trim() : '',
      letterTypeId: draftLetterTypeId,
      isActive: draftActive,
    })
    closeAdd()
  }

  const isEmpty = rules.length === 0

  return (
    <div className="bg-card border-border min-w-0 overflow-hidden rounded-xl border">
      <div
        className={cn(
          'border-border flex gap-3 border-b px-4 py-4 sm:px-5 lg:px-6',
          isCompact ? 'flex-col' : 'flex-row items-center justify-between'
        )}
      >
        <div className="min-w-0">
          <h2 className="text-foreground text-[13px] font-semibold">
            {t('pages.lawyerWorkplace.settings.routing.tableTitle', 'Identification rules')}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-[11.5px]">
            {t(
              'pages.lawyerWorkplace.settings.routing.tableDesc',
              'Rules decide the letter type by sender domain or a word in the subject.'
            )}
          </p>
        </div>
        {!readOnly && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Icons.AddCircle size={18} strokeWidth={1.5} />}
            onClick={openAdd}
            disabled={adding || selectableLetterTypes.length === 0}
            className={cn('h-9 shrink-0 rounded-md', isCompact && 'w-full')}
          >
            {t('pages.lawyerWorkplace.settings.routing.addRule', 'Add rule')}
          </Button>
        )}
      </div>

      {!readOnly && adding && (
        <div className="border-border bg-muted/40 border-b px-4 py-4 sm:px-5 lg:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-muted-foreground text-[11px]">
                {t('pages.lawyerWorkplace.settings.routing.matchType', 'Match')}
              </label>
              <Select
                value={draftMatchType}
                onValueChange={(value) => handleDraftMatchTypeChange(value as RoutingMatchType)}
              >
                <SelectTrigger
                  aria-label={t('pages.lawyerWorkplace.settings.routing.matchType', 'Match')}
                  className={selectTriggerClass}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROUTING_MATCH_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {t(option.labelKey, option.fallback)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {draftNeedsValue && (
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <label className="text-muted-foreground text-[11px]">
                  {t('pages.lawyerWorkplace.settings.routing.value', 'Value')}
                </label>
                <input
                  type="text"
                  aria-label={t('pages.lawyerWorkplace.settings.routing.value', 'Value')}
                  value={draftValue}
                  onChange={(e) => setDraftValue(e.target.value)}
                  placeholder={
                    draftMatchType === 'sender_domain'
                      ? t(
                          'pages.lawyerWorkplace.settings.routing.valueDomainPlaceholder',
                          'e.g. vchasno.ua'
                        )
                      : t(
                          'pages.lawyerWorkplace.settings.routing.valueKeywordPlaceholder',
                          'e.g. statement of claim'
                        )
                  }
                  className={cn(inputClass, 'w-full')}
                />
              </div>
            )}

            <div className="flex min-w-0 flex-col gap-1.5">
              <label className="text-muted-foreground text-[11px]">
                {t('pages.lawyerWorkplace.settings.routing.letterType', 'Letter type')}
              </label>
              <Select value={draftLetterTypeId} onValueChange={setDraftLetterTypeId}>
                <SelectTrigger
                  aria-label={t('pages.lawyerWorkplace.settings.routing.letterType', 'Letter type')}
                  className={selectTriggerClass}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={MOVE_TO_WORKING_VALUE}>
                    {t(
                      'pages.lawyerWorkplace.settings.routing.moveToWorking',
                      'Move to work letters'
                    )}
                  </SelectItem>
                  {selectableLetterTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {t(type.nameKey, type.nameFallback)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 pb-1.5">
              <input
                type="checkbox"
                checked={draftActive}
                onChange={(e) => setDraftActive(e.target.checked)}
                className="accent-secondary-800 border-border h-4 w-4 rounded"
              />
              <span className="text-foreground text-[12px]">
                {t('pages.lawyerWorkplace.settings.routing.active', 'Active')}
              </span>
            </label>

            <div className="flex items-center gap-2 pb-0.5">
              <Button
                variant="primary"
                size="sm"
                disabled={!canSubmitDraft || isSaving}
                onClick={submitDraft}
                className="h-9 rounded-md"
              >
                {t('actions.add', 'Add')}
              </Button>
              <Button variant="cancel" size="sm" onClick={closeAdd} className="h-9 rounded-md">
                {t('actions.cancel', 'Cancel')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <div className="bg-muted mb-4 flex h-12 w-12 items-center justify-center rounded-full">
            <Icons.Filter size={22} strokeWidth={1.5} className="text-muted-foreground" />
          </div>
          <p className="text-foreground text-[14px] font-medium">
            {t('pages.lawyerWorkplace.settings.routing.empty.title', 'No identification rules yet')}
          </p>
          <p className="text-muted-foreground mt-1 max-w-sm text-[12px] leading-relaxed">
            {t(
              'pages.lawyerWorkplace.settings.routing.empty.description',
              'Add a rule to map a sender domain or a subject keyword to a letter type.'
            )}
          </p>
        </div>
      ) : (
        <div className="data-table-scroll w-full overflow-x-auto overflow-y-hidden pb-2">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-border border-b">
                <th className="text-muted-foreground px-5 py-3 text-[11px] font-medium">
                  {t('pages.lawyerWorkplace.settings.routing.matchType', 'Match')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                  {t('pages.lawyerWorkplace.settings.routing.value', 'Value')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                  {t('pages.lawyerWorkplace.settings.routing.letterType', 'Letter type')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                  {t('pages.lawyerWorkplace.settings.routing.active', 'Active')}
                </th>
                <th className="text-muted-foreground px-4 py-3 text-[11px] font-medium">
                  {t('pages.lawyerWorkplace.settings.mailboxes.columns.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, idx) => (
                <tr
                  key={rule.id}
                  className={cn(
                    idx < rules.length - 1 && 'border-border border-b',
                    !rule.isActive && 'opacity-60'
                  )}
                >
                  <td className="px-5 py-4">
                    <span className="text-foreground font-medium">
                      {matchLabel(rule.matchType)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    {rule.matchType === 'default' ? (
                      <span className="text-muted-foreground text-[12px]">—</span>
                    ) : (
                      <span className="text-foreground font-mono text-[12px]">{rule.value}</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <LetterTypeDot
                        colorId={letterTypeById[rule.letterTypeId]?.colorId ?? 'teal'}
                      />
                      <Select
                        value={
                          rule.action === 'move_to_working'
                            ? MOVE_TO_WORKING_VALUE
                            : rule.letterTypeId
                        }
                        disabled={readOnly}
                        onValueChange={(value) => onChangeLetterType(rule, value)}
                      >
                        <SelectTrigger
                          aria-label={t(
                            'pages.lawyerWorkplace.settings.routing.letterType',
                            'Letter type'
                          )}
                          className={cn(selectTriggerClass, 'min-w-[160px]')}
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={MOVE_TO_WORKING_VALUE}>
                            {t(
                              'pages.lawyerWorkplace.settings.routing.moveToWorking',
                              'Move to work letters'
                            )}
                          </SelectItem>
                          {letterTypeOptions(rule.letterTypeId).map((type) => (
                            <SelectItem key={type.id} value={type.id}>
                              {t(type.nameKey, type.nameFallback)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={rule.isActive}
                      disabled={readOnly}
                      onClick={() => onToggle(rule)}
                      aria-label={t('pages.lawyerWorkplace.settings.routing.active', 'Active')}
                      className={cn(
                        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                        rule.isActive ? 'bg-secondary-800' : 'bg-muted',
                        readOnly ? 'cursor-default opacity-60' : 'cursor-pointer'
                      )}
                    >
                      <span
                        className={cn(
                          'bg-background inline-block h-4 w-4 transform rounded-full transition-transform',
                          rule.isActive ? 'translate-x-4' : 'translate-x-0.5'
                        )}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-4">
                    {!readOnly ? (
                      <button
                        type="button"
                        onClick={() => onDelete(rule)}
                        className="text-muted-foreground hover:text-error-600 hover:bg-muted flex h-8 w-8 items-center justify-center rounded-full"
                        aria-label={t('actions.delete', 'Delete')}
                      >
                        <Icons.Delete size={15} strokeWidth={1.5} />
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-[12px]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
