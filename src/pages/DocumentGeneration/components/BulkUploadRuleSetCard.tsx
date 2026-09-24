/**
 * One folder's bulk-upload rules: the credits/ card or the users/ card.
 *
 * A rule says "a file whose name contains this keyword gets this type", and
 * Order decides which rule wins when several match. Order is a position, not a
 * label: saving a rule onto an occupied one pushes the rest down, and deleting
 * closes the gap — the backend renumbers and answers with the whole set, which
 * is what this renders, so the numbers on screen are never a guess.
 *
 * Editing happens in the row, not in a modal: the fields are three, and an
 * admin arranging priorities is comparing rows against each other while doing
 * it. Errors land under the input they are about for the same reason — a
 * duplicate keyword is about that keyword, not about the screen.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useConfirm } from '@/components/ui/useConfirm'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { DocumentType } from '@/features/documentTypes'
import {
  fieldErrorOf,
  useCreateDocumentImportRule,
  useDeleteDocumentImportRule,
  useSetDocumentImportDefault,
  useUpdateDocumentImportRule,
  KEYWORD_MAX_LENGTH,
  type DocumentImportFieldError,
  type DocumentImportFolder,
  type DocumentImportRule,
  type DocumentImportRuleSet,
} from '@/features/documentImportRules'

interface Props {
  folder: DocumentImportFolder
  ruleSet: DocumentImportRuleSet
  documentTypes: DocumentType[]
  disabled?: boolean
}

interface Draft {
  /** Null while adding: the row has no id until the backend gives it one. */
  id: number | null
  position: string
  keyword: string
  documentTypeId: number | null
}

const EMPTY_DRAFT: Draft = { id: null, position: '', keyword: '', documentTypeId: null }

export function BulkUploadRuleSetCard({ folder, ruleSet, documentTypes, disabled }: Props) {
  const { t } = useTranslation('common')
  const { confirm, confirmDialog } = useConfirm()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [error, setError] = useState<DocumentImportFieldError | null>(null)

  const createMutation = useCreateDocumentImportRule()
  const updateMutation = useUpdateDocumentImportRule()
  const deleteMutation = useDeleteDocumentImportRule()
  const defaultMutation = useSetDocumentImportDefault()

  // A rule deleted elsewhere (or a set replaced under us) would leave an editor
  // open over a row that is gone. Derived during render rather than cleared in
  // an effect, so there is never a frame showing an editor for a missing row.
  const activeDraft =
    draft?.id != null && !ruleSet.rules.some((rule) => rule.id === draft.id) ? null : draft

  const typeName = (id: number | null) =>
    documentTypes.find((type) => type.id === id)?.name ??
    (id === null ? null : t('pages.documentGeneration.bulkRules.unknownType', 'Unknown type'))

  const startAdd = () => {
    setError(null)
    setDraft({ ...EMPTY_DRAFT, position: String(ruleSet.rules.length + 1) })
  }

  const startEdit = (rule: DocumentImportRule) => {
    setError(null)
    setDraft({
      id: rule.id,
      position: String(rule.position),
      keyword: rule.keyword,
      documentTypeId: rule.document_type_id,
    })
  }

  const cancel = () => {
    setDraft(null)
    setError(null)
  }

  const save = async () => {
    const draft = activeDraft
    if (!draft) return
    const keyword = draft.keyword.trim()
    if (!keyword) {
      setError({
        message: t('pages.documentGeneration.bulkRules.errors.keywordRequired', 'Enter a keyword'),
        field: 'keyword',
      })
      return
    }
    if (draft.documentTypeId == null) {
      setError({
        message: t(
          'pages.documentGeneration.bulkRules.errors.typeRequired',
          'Choose a document type'
        ),
        field: 'document_type_id',
      })
      return
    }
    const position = Number(draft.position)
    if (!Number.isInteger(position) || position < 1) {
      setError({
        message: t(
          'pages.documentGeneration.bulkRules.errors.positionInvalid',
          'Order must be a whole number of 1 or more'
        ),
        field: 'position',
      })
      return
    }

    setError(null)
    try {
      if (draft.id == null) {
        await createMutation.mutateAsync({
          folder,
          input: { position, keyword, document_type_id: draft.documentTypeId },
        })
      } else {
        await updateMutation.mutateAsync({
          folder,
          ruleId: draft.id,
          input: { position, keyword, document_type_id: draft.documentTypeId },
        })
      }
      setDraft(null)
    } catch (err) {
      const fieldError = fieldErrorOf(err)
      if (fieldError) {
        setError(fieldError)
      } else {
        toast.error(
          t('pages.documentGeneration.bulkRules.errors.saveFailed', 'Could not save the rule')
        )
      }
    }
  }

  const remove = async (rule: DocumentImportRule) => {
    const ok = await confirm({
      title: t(
        'pages.documentGeneration.bulkRules.confirmDeleteTitle',
        "Delete rule '{{keyword}}'?",
        {
          keyword: rule.keyword,
        }
      ),
      message: t(
        'pages.documentGeneration.bulkRules.confirmDelete',
        'Files matching this keyword will take the default type of this folder instead.'
      ),
      confirmLabel: t('actions.delete', 'Delete'),
      cancelLabel: t('actions.cancel', 'Cancel'),
      tone: 'danger',
      icon: <Icons.Delete size={24} className="text-error-600" strokeWidth={2} />,
    })
    if (!ok) return
    try {
      await deleteMutation.mutateAsync({ folder, ruleId: rule.id })
    } catch {
      toast.error(
        t('pages.documentGeneration.bulkRules.errors.deleteFailed', 'Could not delete the rule')
      )
    }
  }

  const changeDefault = async (value: string) => {
    try {
      await defaultMutation.mutateAsync({ folder, documentTypeId: Number(value) })
    } catch (err) {
      const fieldError = fieldErrorOf(err)
      toast.error(
        fieldError?.message ??
          t(
            'pages.documentGeneration.bulkRules.errors.defaultFailed',
            'Could not set the default type'
          )
      )
    }
  }

  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    defaultMutation.isPending
  const errorFor = (field: DocumentImportFieldError['field']): string | null => {
    const current = error
    return current && current.field === field ? current.message : null
  }

  const typeSelect = (
    value: number | null,
    onChange: (id: number) => void,
    ariaLabel: string,
    invalid = false
  ) => (
    <Select
      value={value == null ? undefined : String(value)}
      onValueChange={(next) => onChange(Number(next))}
      disabled={disabled || busy}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn('h-9 w-full', invalid && 'border-error-500')}
      >
        <SelectValue placeholder={t('pages.documentGeneration.bulkRules.notSet', 'Not set')} />
      </SelectTrigger>
      <SelectContent>
        {documentTypes.map((type) => (
          <SelectItem key={type.id} value={String(type.id)}>
            {type.name}
            {type.is_hidden && (
              <span className="text-muted-foreground ml-2 text-xs">
                ({t('pages.documentGeneration.types.hiddenLabel', 'hidden')})
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  const inlineError = (field: DocumentImportFieldError['field']) => {
    const message = errorFor(field)
    if (!message) return null
    return (
      <p role="alert" className="text-error-600 mt-1 text-xs">
        {message}
      </p>
    )
  }

  /** The editing row, shared by "add" and "edit" — the fields are the same. */
  const editorRow = (current: Draft, key: string) => (
    <tr key={key} className="border-border border-b align-top">
      <td className="py-2 pr-2">
        <Input
          type="number"
          min={1}
          value={current.position}
          aria-label={t('pages.documentGeneration.bulkRules.columns.order', 'Order')}
          onChange={(e) => setDraft({ ...current, position: e.target.value })}
          className={cn('h-9', errorFor('position') && 'border-error-500')}
        />
        {inlineError('position')}
      </td>
      <td className="py-2 pr-2">
        <Input
          value={current.keyword}
          maxLength={KEYWORD_MAX_LENGTH}
          aria-label={t('pages.documentGeneration.bulkRules.columns.keyword', 'Keyword')}
          onChange={(e) => setDraft({ ...current, keyword: e.target.value })}
          className={cn('h-9', errorFor('keyword') && 'border-error-500')}
        />
        {inlineError('keyword')}
      </td>
      <td className="py-2 pr-2">
        {typeSelect(
          current.documentTypeId,
          (id) => setDraft({ ...current, documentTypeId: id }),
          t('pages.documentGeneration.bulkRules.columns.type', 'Document type'),
          Boolean(errorFor('document_type_id'))
        )}
        {inlineError('document_type_id')}
      </td>
      <td className="py-2 text-right whitespace-nowrap">
        <Button type="button" size="sm" onClick={save} disabled={busy}>
          {t('actions.save', 'Save')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={cancel}
          disabled={busy}
          className="ml-1"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
      </td>
    </tr>
  )

  return (
    <div className="border-border bg-card rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-foreground text-base font-medium">
          {folder === 'credits'
            ? t('pages.documentGeneration.bulkRules.creditsTitle', 'credits/ folder')
            : t('pages.documentGeneration.bulkRules.usersTitle', 'users/ folder')}
        </h3>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={startAdd}
          disabled={disabled || busy || activeDraft !== null}
        >
          <Icons.Add size={16} strokeWidth={2} />
          {t('pages.documentGeneration.bulkRules.addRule', 'Add rule')}
        </Button>
      </div>

      <table className="w-full table-fixed text-sm">
        <thead>
          <tr className="text-muted-foreground border-border border-b text-left">
            <th className="w-20 py-2 font-normal">
              {t('pages.documentGeneration.bulkRules.columns.order', 'Order')}
            </th>
            <th className="py-2 font-normal">
              {t('pages.documentGeneration.bulkRules.columns.keyword', 'Keyword')}
            </th>
            <th className="py-2 font-normal">
              {t('pages.documentGeneration.bulkRules.columns.type', 'Document type')}
            </th>
            <th className="w-24 py-2 text-right font-normal">
              {t('pages.documentGeneration.bulkRules.columns.actions', 'Actions')}
            </th>
          </tr>
        </thead>
        <tbody>
          {ruleSet.rules.length === 0 && activeDraft === null && (
            <tr>
              <td colSpan={4} className="text-muted-foreground py-6 text-center">
                {t(
                  'pages.documentGeneration.bulkRules.empty',
                  'No rules yet — every file takes the default type below.'
                )}
              </td>
            </tr>
          )}

          {ruleSet.rules.map((rule) =>
            activeDraft?.id === rule.id ? (
              editorRow(activeDraft, String(rule.id))
            ) : (
              <tr key={rule.id} className="border-border border-b">
                <td className="py-2">{rule.position}</td>
                <td className="py-2 break-words">{rule.keyword}</td>
                <td className="py-2 break-words">{typeName(rule.document_type_id)}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title={t('actions.edit', 'Edit')}
                    aria-label={t(
                      'pages.documentGeneration.bulkRules.editRule',
                      'Edit rule {{keyword}}',
                      { keyword: rule.keyword }
                    )}
                    onClick={() => startEdit(rule)}
                    disabled={disabled || busy || activeDraft !== null}
                  >
                    <Icons.Edit size={16} strokeWidth={2} />
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    title={t('actions.delete', 'Delete')}
                    aria-label={t(
                      'pages.documentGeneration.bulkRules.deleteRule',
                      'Delete rule {{keyword}}',
                      { keyword: rule.keyword }
                    )}
                    onClick={() => remove(rule)}
                    disabled={disabled || busy || activeDraft !== null}
                    className="text-error-600 hover:bg-error-100"
                  >
                    <Icons.Delete size={16} strokeWidth={2} />
                  </Button>
                </td>
              </tr>
            )
          )}

          {activeDraft !== null && activeDraft.id == null && editorRow(activeDraft, 'new')}
        </tbody>
      </table>

      <div className="border-border mt-3 border-t pt-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-foreground text-sm font-medium">
              {t('pages.documentGeneration.bulkRules.defaultLabel', 'Default document type')}
            </p>
            <p className="text-muted-foreground text-xs">
              {t(
                'pages.documentGeneration.bulkRules.defaultHint',
                'Applied to files that match no keyword. A bulk upload cannot start until both folders have one.'
              )}
            </p>
          </div>
          <div className="w-full sm:w-64">
            {typeSelect(
              ruleSet.default_document_type_id,
              (id) => void changeDefault(String(id)),
              t('pages.documentGeneration.bulkRules.defaultLabel', 'Default document type')
            )}
            {ruleSet.default_document_type_id === null && (
              <p className="text-warning-600 mt-1 text-xs">
                {t('pages.documentGeneration.bulkRules.notSet', 'Not set')}
              </p>
            )}
          </div>
        </div>
      </div>

      {confirmDialog}
    </div>
  )
}
