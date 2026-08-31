/**
 * QaBlockersTable — the critical-blocker dictionary (26B «стоп-фрази»).
 *
 * One row per phrase: phrase / category / severity / language / active.
 * Adding happens inline in the footer row, editing switches a row into
 * inputs in place, «видалити» asks for confirmation first.
 *
 * The endpoint can filter by category / severity / language / activity, but
 * the dictionary is a few dozen rows, so it is fetched whole instead
 * (inactive included — the activity checkbox has to be able to show and flip
 * both states) and narrowed on the client: one cached list, no refetch and
 * no flicker as the trainer flips filters.
 *
 * Deletion is SOFT server-side: it flips `is_active` to false and keeps the
 * row, so the confirmation says «деактивувати», not «стерти».
 *
 * Everything here is write-gated by `manage_qa_rules` upstream (the whole
 * tab is), so the component itself renders no permission checks.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { Icons } from '@/lib/icons'

import {
  useCreateQaBlocker,
  useDeleteQaBlocker,
  useQaBlockers,
  useUpdateQaBlocker,
} from '../../hooks/useQaRules'
import { isConflict } from '../../lib/qaRuleErrors'
import type {
  BlockerCategory,
  BlockerLang,
  BlockerSeverity,
  QaBlocker,
  QaBlockerCreatePayload,
  QaBlockerUpdatePayload,
} from '../../types'
import {
  BLOCKER_CATEGORY_OPTIONS,
  BLOCKER_LANG_OPTIONS,
  BLOCKER_SEVERITY_OPTIONS,
  categoryKey,
  langKey,
  QA_INPUT_CLS,
  severityKey,
  SEVERITY_TONE,
} from './qaRuleOptions'

const EMPTY_DRAFT: QaBlockerCreatePayload = {
  phrase: '',
  category: 'script_critical',
  severity: 'critical',
  lang: 'uk',
}

/** Server-side bounds on `phrase`; mirrored so the 422 never happens. */
const PHRASE_MIN = 2
const PHRASE_MAX = 200

const TH = 'px-3 py-2 text-left text-[11px] font-medium text-[#6B7280]'
const TD = 'px-3 py-2 align-middle text-xs text-[#05040D]'

function phraseValid(raw: string): boolean {
  const phrase = raw.trim()
  return phrase.length >= PHRASE_MIN && phrase.length <= PHRASE_MAX
}

export function QaBlockersTable() {
  const { t } = useTranslation('common')
  const { confirm, confirmDialog } = useConfirm()

  const [categoryFilter, setCategoryFilter] = useState('')
  const [langFilter, setLangFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [draft, setDraft] = useState<QaBlockerCreatePayload>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<QaBlockerUpdatePayload>({})

  // Always fetched with the inactive rows: the activity checkbox must be able
  // to show a deactivated phrase, and the list is small enough to filter here.
  const { data: allBlockers = [], isLoading, isError } = useQaBlockers({ include_inactive: true })

  const blockers = useMemo(
    () =>
      allBlockers.filter((blocker) => {
        if (!showInactive && !blocker.is_active) return false
        if (categoryFilter && blocker.category !== categoryFilter) return false
        if (langFilter && blocker.lang !== langFilter) return false
        return true
      }),
    [allBlockers, showInactive, categoryFilter, langFilter]
  )

  const createMutation = useCreateQaBlocker()
  const updateMutation = useUpdateQaBlocker()
  const deleteMutation = useDeleteQaBlocker()

  const reportError = (error: unknown) => {
    toast.error(
      isConflict(error)
        ? t('pages.qaRules.blockers.duplicate', 'That phrase is already in the dictionary')
        : t('pages.qaRules.saveError', 'Could not save the change')
    )
  }

  const handleCreate = async () => {
    if (!phraseValid(draft.phrase)) return
    try {
      await createMutation.mutateAsync({ ...draft, phrase: draft.phrase.trim() })
      setDraft(EMPTY_DRAFT)
      toast.success(t('pages.qaRules.blockers.created', 'Blocker added'))
    } catch (error) {
      reportError(error)
    }
  }

  const startEdit = (blocker: QaBlocker) => {
    setEditingId(blocker.id)
    setEditDraft({
      phrase: blocker.phrase,
      category: blocker.category as BlockerCategory,
      severity: blocker.severity as BlockerSeverity,
      lang: blocker.lang as BlockerLang,
      is_active: blocker.is_active,
    })
  }

  const handleUpdate = async (id: string, payload: QaBlockerUpdatePayload) => {
    try {
      await updateMutation.mutateAsync({ id, payload })
      setEditingId(null)
      toast.success(t('pages.qaRules.blockers.updated', 'Blocker updated'))
    } catch (error) {
      reportError(error)
    }
  }

  const handleDelete = async (blocker: QaBlocker) => {
    const ok = await confirm({
      title: t('pages.qaRules.blockers.deleteTitle', 'Deactivate blocker?'),
      message: t('pages.qaRules.blockers.deleteMessage', '«{{phrase}}» stops flagging calls.', {
        phrase: blocker.phrase,
      }),
      confirmLabel: t('pages.qaRules.blockers.deactivate', 'Deactivate'),
      tone: 'danger',
    })
    if (!ok) return
    try {
      await deleteMutation.mutateAsync(blocker.id)
      toast.success(t('pages.qaRules.blockers.deleted', 'Blocker deactivated'))
    } catch (error) {
      reportError(error)
    }
  }

  const editPhraseValid = phraseValid(editDraft.phrase ?? '')

  return (
    <div className="flex flex-col gap-3" data-testid="qa-blockers-table">
      {confirmDialog}

      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label={t('pages.qaRules.blockers.categoryFilter', 'Category')}
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={QA_INPUT_CLS}
        >
          <option value="">{t('pages.qaRules.blockers.allCategories', 'All categories')}</option>
          {BLOCKER_CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {t(categoryKey(c), c)}
            </option>
          ))}
        </select>
        <select
          aria-label={t('pages.qaRules.blockers.langFilter', 'Language')}
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className={QA_INPUT_CLS}
        >
          <option value="">{t('pages.qaRules.blockers.allLangs', 'All languages')}</option>
          {BLOCKER_LANG_OPTIONS.map((l) => (
            <option key={l} value={l}>
              {t(langKey(l), l)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[11px] text-[#6B7280]">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          {t('pages.qaRules.blockers.showInactive', 'Show deactivated')}
        </label>
        <span className="text-[11px] text-[#6B7280]">
          {t('pages.qaRules.blockers.total', 'Phrases')}: {blockers.length}
        </span>
      </div>

      {isError ? (
        <div className="rounded-lg bg-white p-6 text-center text-xs text-red-500 shadow-sm">
          {t('pages.qaRules.blockers.loadError', 'Failed to load the blocker dictionary.')}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-[#EBECE8] bg-white">
        <table className="w-full min-w-[720px] border-collapse">
          <thead className="border-b border-[#EBECE8] bg-[#FAFAFA]">
            <tr>
              <th className={TH}>{t('pages.qaRules.blockers.phrase', 'Phrase')}</th>
              <th className={TH}>{t('pages.qaRules.blockers.category', 'Category')}</th>
              <th className={TH}>{t('pages.qaRules.blockers.severity', 'Severity')}</th>
              <th className={TH}>{t('pages.qaRules.blockers.lang', 'Language')}</th>
              <th className={TH}>{t('pages.qaRules.blockers.active', 'Active')}</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td className={`${TD} text-center text-[#6B7280]`} colSpan={6}>
                  {t('common.loading', 'Loading…')}
                </td>
              </tr>
            ) : blockers.length === 0 ? (
              <tr>
                <td className={`${TD} text-center text-[#6B7280]`} colSpan={6}>
                  {t('pages.qaRules.blockers.empty', 'No blockers yet.')}
                </td>
              </tr>
            ) : (
              blockers.map((blocker) =>
                editingId === blocker.id ? (
                  <tr key={blocker.id} className="border-b border-[#F1F1F1] bg-[#FCFDF7]">
                    <td className={TD}>
                      <input
                        aria-label={t('pages.qaRules.blockers.phrase', 'Phrase')}
                        value={editDraft.phrase ?? ''}
                        maxLength={PHRASE_MAX}
                        onChange={(e) => setEditDraft({ ...editDraft, phrase: e.target.value })}
                        className={`${QA_INPUT_CLS} w-full`}
                      />
                    </td>
                    <td className={TD}>
                      <CategorySelect
                        value={editDraft.category ?? 'script_critical'}
                        onChange={(category) => setEditDraft({ ...editDraft, category })}
                      />
                    </td>
                    <td className={TD}>
                      <SeveritySelect
                        value={editDraft.severity ?? 'critical'}
                        onChange={(severity) => setEditDraft({ ...editDraft, severity })}
                      />
                    </td>
                    <td className={TD}>
                      <LangSelect
                        value={editDraft.lang ?? 'uk'}
                        onChange={(lang) => setEditDraft({ ...editDraft, lang })}
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="checkbox"
                        aria-label={t('pages.qaRules.blockers.active', 'Active')}
                        checked={editDraft.is_active ?? true}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, is_active: e.target.checked })
                        }
                      />
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!editPhraseValid || updateMutation.isPending}
                          onClick={() => handleUpdate(blocker.id, editDraft)}
                        >
                          {t('actions.save', 'Save')}
                        </Button>
                        <Button size="sm" variant="cancel" onClick={() => setEditingId(null)}>
                          {t('actions.cancel', 'Cancel')}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={blocker.id}
                    className={`border-b border-[#F1F1F1] ${blocker.is_active ? '' : 'opacity-60'}`}
                  >
                    <td className={`${TD} max-w-[320px]`}>{blocker.phrase}</td>
                    <td className={TD}>{t(categoryKey(blocker.category), blocker.category)}</td>
                    <td className={TD}>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          SEVERITY_TONE[blocker.severity] ?? SEVERITY_TONE.low
                        }`}
                      >
                        {t(severityKey(blocker.severity), blocker.severity)}
                      </span>
                    </td>
                    <td className={TD}>{t(langKey(blocker.lang), blocker.lang)}</td>
                    <td className={TD}>
                      <input
                        type="checkbox"
                        aria-label={t('pages.qaRules.blockers.active', 'Active')}
                        checked={blocker.is_active}
                        disabled={updateMutation.isPending}
                        onChange={(e) => handleUpdate(blocker.id, { is_active: e.target.checked })}
                      />
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(blocker)}
                          className="rounded-md border border-[#EDEDED] px-2 py-1 text-[11px] text-[#4B5563] hover:bg-[#F7F7F7]"
                        >
                          {t('actions.edit', 'Edit')}
                        </button>
                        {blocker.is_active ? (
                          <button
                            type="button"
                            onClick={() => handleDelete(blocker)}
                            className="rounded-md border border-[#FECACA] px-2 py-1 text-[11px] text-[#B91C1C] hover:bg-[#FEF2F2]"
                          >
                            {t('pages.qaRules.blockers.deactivate', 'Deactivate')}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              )
            )}

            {/* Inline add row — always last, always visible. A new phrase is
              created active; `is_active` is not part of the POST body. */}
            <tr className="bg-[#FAFAFA]">
              <td className={TD}>
                <input
                  aria-label={t('pages.qaRules.blockers.newPhrase', 'New phrase')}
                  value={draft.phrase}
                  maxLength={PHRASE_MAX}
                  onChange={(e) => setDraft({ ...draft, phrase: e.target.value })}
                  placeholder={t('pages.qaRules.blockers.newPhrase', 'New phrase')}
                  className={`${QA_INPUT_CLS} w-full`}
                />
              </td>
              <td className={TD}>
                <CategorySelect
                  value={draft.category}
                  onChange={(category) => setDraft({ ...draft, category })}
                />
              </td>
              <td className={TD}>
                <SeveritySelect
                  value={draft.severity}
                  onChange={(severity) => setDraft({ ...draft, severity })}
                />
              </td>
              <td className={TD}>
                <LangSelect value={draft.lang} onChange={(lang) => setDraft({ ...draft, lang })} />
              </td>
              <td className={TD} />
              <td className={`${TD} whitespace-nowrap`}>
                <Button
                  size="sm"
                  variant="primary"
                  leftIcon={<Icons.Add size={14} />}
                  disabled={!phraseValid(draft.phrase) || createMutation.isPending}
                  onClick={handleCreate}
                >
                  {t('pages.qaRules.blockers.add', 'Add')}
                </Button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CategorySelect({
  value,
  onChange,
}: {
  value: BlockerCategory
  onChange: (value: BlockerCategory) => void
}) {
  const { t } = useTranslation('common')
  return (
    <select
      aria-label={t('pages.qaRules.blockers.category', 'Category')}
      value={value}
      onChange={(e) => onChange(e.target.value as BlockerCategory)}
      className={QA_INPUT_CLS}
    >
      {BLOCKER_CATEGORY_OPTIONS.map((c) => (
        <option key={c} value={c}>
          {t(categoryKey(c), c)}
        </option>
      ))}
    </select>
  )
}

function SeveritySelect({
  value,
  onChange,
}: {
  value: BlockerSeverity
  onChange: (value: BlockerSeverity) => void
}) {
  const { t } = useTranslation('common')
  return (
    <select
      aria-label={t('pages.qaRules.blockers.severity', 'Severity')}
      value={value}
      onChange={(e) => onChange(e.target.value as BlockerSeverity)}
      className={QA_INPUT_CLS}
    >
      {BLOCKER_SEVERITY_OPTIONS.map((s) => (
        <option key={s} value={s}>
          {t(severityKey(s), s)}
        </option>
      ))}
    </select>
  )
}

function LangSelect({
  value,
  onChange,
}: {
  value: BlockerLang
  onChange: (value: BlockerLang) => void
}) {
  const { t } = useTranslation('common')
  return (
    <select
      aria-label={t('pages.qaRules.blockers.lang', 'Language')}
      value={value}
      onChange={(e) => onChange(e.target.value as BlockerLang)}
      className={QA_INPUT_CLS}
    >
      {BLOCKER_LANG_OPTIONS.map((l) => (
        <option key={l} value={l}>
          {t(langKey(l), l)}
        </option>
      ))}
    </select>
  )
}

export default QaBlockersTable
