/**
 * Create / Edit modal for a Document Template (KAN-403 Tab 2).
 *
 * A template is one of two kinds:
 *   - `text`  — body authored in a <Textarea>; variables are spliced in via the
 *               side panel, exactly like the SMS Templates form.
 *   - `docx`  — body derived from an uploaded .docx file; the file is the source
 *               of truth, so the body is read-only and the operator replaces the
 *               file to change it.
 *
 * On create the operator picks the kind; on edit the kind is fixed. The variable
 * dictionary is fetched from the backend (37 entries) — in text mode it is a
 * click-to-insert palette, in docx mode a read-only reference the lawyer copies
 * into Word.
 *
 * The component is unmounted when the modal closes, so we can rely on lazy state
 * initialisers — no useEffect needed to hydrate from props.
 */

import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cancel01Icon, Icon, Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { cn } from '@/lib/utils'
import {
  useComposeDocumentTemplate,
  useCreateDocumentTemplate,
  useDocumentTemplateVariables,
  useReplaceDocumentTemplateFile,
  useUpdateDocumentTemplate,
  useUploadDocumentTemplate,
  downloadDocumentTemplateFile,
  previewDocumentTemplateFile,
  type DocumentActivationRule,
  type DocumentTemplate,
  type DocumentTemplateKind,
  type TemplateVariableDefinition,
} from '@/features/documents'
import { downloadBlob } from '@/features/messaging/utils/downloadBlob'
import { useDocumentTypes } from '@/features/documentTypes'
// Activation-tag catalog: reuse the same tag list the client filters use.
// ⚠️ The `tag_active` rule stores a client_db tag id server-side — confirm this
// source yields the id space client-service expects (see team note).
import { useTags } from '@/features/tags'
import { DocumentTypePill } from '@/components/DocumentTypePill'
import { buildSampleVariableMap, substituteVariables } from './templateVariables'
import { DocumentFileViewer } from './DocumentFileViewer'
import { TemplatePreviewModal } from './TemplatePreviewModal'

interface Props {
  open: boolean
  onClose: () => void
  /** When provided, the modal is in edit mode. */
  template?: DocumentTemplate | null
}

const ACCEPT_DOCX = '.docx'

/** English fallbacks for variable-group headings (used when i18n is unset). */
const GROUP_FALLBACK: Record<string, string> = {
  client: 'Client',
  credit: 'Credit',
  promise: 'Promise',
  restructuring: 'Restructuring',
  system: 'System',
}

const ACTIVATION_RULES: DocumentActivationRule[] = [
  'always',
  'active_debt',
  'closed_debt',
  'rr_active',
  'rr_first_payment',
  'promise_active',
  'tag_active',
]

/** English fallbacks for activation-rule options (used when i18n is unset). */
const ACTIVATION_RULE_FALLBACK: Record<DocumentActivationRule, string> = {
  always: 'Always available',
  active_debt: 'Active debt',
  closed_debt: 'Closed debt',
  rr_active: 'Active restructuring',
  rr_first_payment: 'First restructuring payment',
  promise_active: 'Active payment promise',
  tag_active: 'Active tag',
}

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(0)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export function DocumentTemplateEditor({ open, onClose, template }: Props) {
  const { t, i18n } = useTranslation('common')
  const isEdit = !!template

  // Kind is chosen on create, fixed on edit. 'compose' is a CREATE-only UI
  // mode (branded constructor) — the stored template is a regular docx.
  type CreateKind = DocumentTemplateKind | 'compose'
  const [templateKind, setTemplateKind] = useState<CreateKind>(
    () => template?.template_kind ?? 'text'
  )
  const [composeTitle, setComposeTitle] = useState('')
  const [includeSchedule, setIncludeSchedule] = useState(false)
  const [includeRequisites, setIncludeRequisites] = useState(true)

  // Lazy initialisers — populated once when the modal opens.
  const [name, setName] = useState(() => template?.name ?? '')
  const [description, setDescription] = useState(() => template?.description ?? '')
  const [body, setBody] = useState(() => template?.body ?? '')
  const [isActive, setIsActive] = useState(() => template?.is_active ?? true)
  const [documentTypeId, setDocumentTypeId] = useState<number | null>(
    () => template?.document_type_id ?? null
  )
  const [activationRule, setActivationRule] = useState<DocumentActivationRule>(
    () => template?.activation_rule ?? 'always'
  )
  const [activationTagId, setActivationTagId] = useState<number | null>(
    () => template?.activation_tag_id ?? null
  )
  const [file, setFile] = useState<File | null>(null)
  const [replaceFile, setReplaceFile] = useState<File | null>(null)
  /** Placeholders in the just-uploaded file that are outside the dictionary. */
  const [uploadWarning, setUploadWarning] = useState<string[] | null>(null)
  const [replaceWarning, setReplaceWarning] = useState<string[] | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // Inline "how it will look" section (docx edit only) — collapsed by default so
  // the heavy preview only loads once the lawyer asks for it.
  const [sampleExpanded, setSampleExpanded] = useState(false)
  const [previewFullscreen, setPreviewFullscreen] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Create-file and replace-file dropzones never mount at the same time
  // (create vs. edit-docx are mutually exclusive), so one ref is enough.
  const fileInputRef = useRef<HTMLInputElement>(null)

  const createMutation = useCreateDocumentTemplate()
  const updateMutation = useUpdateDocumentTemplate()
  const uploadMutation = useUploadDocumentTemplate()
  const composeMutation = useComposeDocumentTemplate()
  const replaceMutation = useReplaceDocumentTemplateFile()
  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    uploadMutation.isPending ||
    composeMutation.isPending ||
    replaceMutation.isPending

  const { data: variablesData } = useDocumentTemplateVariables()
  const { data: documentTypes } = useDocumentTypes({ includeHidden: false })
  // Tag catalog for the `tag_active` activation rule (same list the client
  // filters use). The tag is required only when that rule is selected.
  const requiresActivationTag = activationRule === 'tag_active'
  const { data: activationTags } = useTags(undefined, { includeHidden: false })
  const variableItems = useMemo(() => variablesData?.items ?? [], [variablesData])
  const variableGroups = variablesData?.groups ?? []

  const sampleMap = useMemo(() => buildSampleVariableMap(variableItems), [variableItems])
  const previewText = useMemo(
    () => (templateKind === 'text' ? substituteVariables(body, sampleMap) : ''),
    [templateKind, body, sampleMap]
  )

  // Sample-data render of the docx (edit mode). Shares its query key with
  // TemplatePreviewModal's "sample" tab, so opening fullscreen reuses this blob.
  const isDocxEdit = isEdit && templateKind === 'docx'
  const {
    data: sampleBlob,
    isLoading: sampleLoading,
    isError: sampleError,
  } = useQuery({
    queryKey: ['document-template-preview', template?.id, 'sample', 'pdf'],
    queryFn: () => previewDocumentTemplateFile(template!.id, 'pdf'),
    enabled: isDocxEdit && sampleExpanded && !!template,
    staleTime: 5 * 60 * 1000,
  })

  const baseLang = (i18n.language ?? 'en').split('-')[0]
  const variableLabel = (v: TemplateVariableDefinition): string =>
    v.labels[baseLang] ?? v.labels.uk ?? v.labels.en ?? v.name
  const groupLabel = (group: string): string =>
    t(`pages.documentGeneration.templates.variableGroups.${group}`, GROUP_FALLBACK[group] ?? group)
  const activationRuleLabel = (rule: DocumentActivationRule): string =>
    t(`pages.documentGeneration.templates.activationRules.${rule}`, ACTIVATION_RULE_FALLBACK[rule])

  /** Insert `{{name}}` at the textarea's current cursor (text mode only). */
  const handleInsert = (variableName: string) => {
    const token = `{{${variableName}}}`
    const ta = textareaRef.current
    if (!ta) {
      setBody((prev) => prev + token)
      return
    }
    const start = ta.selectionStart ?? body.length
    const end = ta.selectionEnd ?? body.length
    const next = body.slice(0, start) + token + body.slice(end)
    setBody(next)
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + token.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const requireName = (): string | null => {
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(
        t('pages.documentGeneration.templates.errors.nameRequired', 'Template name is required')
      )
      return null
    }
    return trimmed
  }

  /** Block submit when `tag_active` is chosen but no tag was picked. */
  const ensureActivationTag = (): boolean => {
    if (requiresActivationTag && activationTagId == null) {
      toast.error(
        t(
          'pages.documentGeneration.templates.errors.activationTagRequired',
          'Оберіть тег для правила «Активний тег»'
        )
      )
      return false
    }
    return true
  }

  // Sent on every save: the tag id when `tag_active`, else null to clear it.
  const activationTagPayload = requiresActivationTag ? activationTagId : null

  const handleTextSubmit = async () => {
    const trimmedName = requireName()
    if (!trimmedName) return
    if (!body.trim()) {
      toast.error(
        t('pages.documentGeneration.templates.errors.bodyRequired', 'Template body is required')
      )
      return
    }
    if (!ensureActivationTag()) return
    try {
      if (isEdit && template) {
        // PUT is partial: null means "leave unchanged" server-side, so send
        // the (possibly empty) string to allow clearing the description.
        await updateMutation.mutateAsync({
          id: template.id,
          payload: {
            name: trimmedName,
            description: description.trim(),
            body,
            activation_rule: activationRule,
            activation_tag_id: activationTagPayload,
          },
        })
        toast.success(t('pages.documentGeneration.templates.messages.updated', 'Template updated'))
      } else {
        await createMutation.mutateAsync({
          name: trimmedName,
          description: description.trim() || null,
          body,
          activation_rule: activationRule,
          activation_tag_id: activationTagPayload,
        })
        toast.success(t('pages.documentGeneration.templates.messages.created', 'Template created'))
      }
      onClose()
    } catch {
      // Error toast handled by the mutation's onError.
    }
  }

  const handleDocxCreate = async () => {
    const trimmedName = requireName()
    if (!trimmedName) return
    if (!file) {
      toast.error(
        t('pages.documentGeneration.templates.errors.fileRequired', 'Please choose a .docx file')
      )
      return
    }
    if (!ensureActivationTag()) return
    const fd = new FormData()
    fd.append('file', file)
    fd.append('name', trimmedName)
    if (description.trim()) fd.append('description', description.trim())
    fd.append('activation_rule', activationRule)
    if (activationTagPayload != null) fd.append('activation_tag_id', String(activationTagPayload))
    if (documentTypeId != null) fd.append('document_type_id', String(documentTypeId))
    try {
      const res = await uploadMutation.mutateAsync(fd)
      toast.success(t('pages.documentGeneration.templates.messages.uploaded', 'Template uploaded'))
      if (res.unknown_variables.length > 0) {
        // Keep the modal open on a terminal warning screen — the template is
        // already saved and the list refreshed; the operator must see this.
        setUploadWarning(res.unknown_variables)
      } else {
        onClose()
      }
    } catch {
      // Error toast handled by the mutation's onError.
    }
  }

  const handleComposeCreate = async () => {
    const trimmedName = requireName()
    if (!trimmedName) return
    if (!composeTitle.trim()) {
      toast.error(
        t('pages.documentGeneration.templates.errors.titleRequired', 'Вкажіть заголовок документа')
      )
      return
    }
    if (!body.trim()) {
      toast.error(
        t('pages.documentGeneration.templates.errors.bodyRequired', 'Template body is required')
      )
      return
    }
    if (!ensureActivationTag()) return
    try {
      const res = await composeMutation.mutateAsync({
        name: trimmedName,
        description: description.trim() || null,
        title: composeTitle.trim(),
        body,
        include_schedule: includeSchedule,
        include_requisites: includeRequisites,
        activation_rule: activationRule,
        activation_tag_id: activationTagPayload,
        document_type_id: documentTypeId,
      })
      toast.success(t('pages.documentGeneration.templates.messages.created', 'Template created'))
      if (res.unknown_variables.length > 0) {
        setUploadWarning(res.unknown_variables)
      } else {
        onClose()
      }
    } catch {
      // Error toast handled by the mutation's onError.
    }
  }

  const handleDocxEditSave = async () => {
    if (!template) return
    const trimmedName = requireName()
    if (!trimmedName) return
    if (!ensureActivationTag()) return
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        payload: {
          name: trimmedName,
          // See handleTextSubmit — empty string clears, null would be ignored.
          description: description.trim(),
          is_active: isActive,
          activation_rule: activationRule,
          activation_tag_id: activationTagPayload,
          document_type_id: documentTypeId,
        },
      })
      toast.success(t('pages.documentGeneration.templates.messages.updated', 'Template updated'))
      onClose()
    } catch {
      // Error toast handled by the mutation's onError.
    }
  }

  const handleReplace = async () => {
    if (!template || !replaceFile) return
    const fd = new FormData()
    fd.append('file', replaceFile)
    try {
      const res = await replaceMutation.mutateAsync({ id: template.id, formData: fd })
      toast.success(
        t('pages.documentGeneration.templates.messages.fileReplaced', 'Template file replaced')
      )
      setReplaceFile(null)
      setReplaceWarning(res.unknown_variables.length > 0 ? res.unknown_variables : null)
    } catch {
      // Error toast handled by the mutation's onError.
    }
  }

  const handleDownload = async () => {
    if (!template) return
    try {
      const blob = await downloadDocumentTemplateFile(template.id)
      downloadBlob(blob, template.file_name ?? `${template.name}.docx`)
    } catch {
      toast.error(
        t('pages.documentGeneration.templates.messages.downloadError', 'Failed to download file')
      )
    }
  }

  const handlePrimarySubmit = () => {
    if (templateKind === 'text') return handleTextSubmit()
    if (templateKind === 'compose') return handleComposeCreate()
    return isEdit ? handleDocxEditSave() : handleDocxCreate()
  }

  const title = isEdit
    ? t('pages.documentGeneration.templates.modals.editTitle', 'Edit template')
    : t('pages.documentGeneration.templates.modals.createTitle', 'Create template')

  const renderVariablesPanel = (mode: 'insert' | 'reference') => (
    <aside className="border-border bg-card w-full shrink-0 rounded-lg border p-3 lg:w-72">
      <h3 className="text-foreground mb-2 text-sm font-semibold">
        {t('pages.documentGeneration.templates.form.variables', 'Variables')}
      </h3>
      <p className="text-muted-foreground mb-3 text-xs">
        {mode === 'insert'
          ? t(
              'pages.documentGeneration.templates.form.variablesHelp',
              'Click a variable to insert it at the cursor.'
            )
          : t(
              'pages.documentGeneration.templates.form.variablesReferenceHelp',
              'Use these names in your Word file as {{name}}.'
            )}
      </p>
      <div className="flex max-h-[40vh] flex-col gap-3 overflow-y-auto pr-1 lg:max-h-[60vh]">
        {variableGroups.map((group) => {
          const items = variableItems.filter((v) => v.group === group)
          if (items.length === 0) return null
          return (
            <div key={group} className="flex flex-col gap-1">
              <span className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                {groupLabel(group)}
              </span>
              <div className="flex flex-col gap-1">
                {items.map((v) =>
                  mode === 'insert' ? (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => handleInsert(v.name)}
                      className="border-border bg-card hover:bg-muted hover:border-primary-300 flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left text-xs transition-colors"
                    >
                      <code className="text-primary-700 text-[11px]">{`{{${v.name}}}`}</code>
                      <span className="text-muted-foreground text-[11px] leading-tight">
                        {variableLabel(v)}
                      </span>
                    </button>
                  ) : (
                    <div
                      key={v.name}
                      className="border-border bg-card flex flex-col items-start gap-0.5 rounded-md border px-2 py-1.5 text-left text-xs"
                    >
                      <code className="text-primary-700 text-[11px]">{`{{${v.name}}}`}</code>
                      <span className="text-muted-foreground text-[11px] leading-tight">
                        {variableLabel(v)}
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )

  const renderDropZone = (selected: File | null, onSelect: (f: File) => void, inputId: string) => {
    return (
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const f = e.dataTransfer.files?.[0]
          if (f) onSelect(f)
        }}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors',
          dragOver
            ? 'border-primary-400 bg-primary-50'
            : selected
              ? 'border-primary-300 bg-primary-50/50'
              : 'border-border hover:border-primary-300 hover:bg-muted'
        )}
      >
        <input
          id={inputId}
          ref={fileInputRef}
          type="file"
          accept={ACCEPT_DOCX}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onSelect(f)
            // Allow re-selecting the same filename in a row.
            e.target.value = ''
          }}
        />
        <Icons.File size={28} strokeWidth={1.5} className="text-muted-foreground" />
        {selected ? (
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-foreground text-sm font-medium">{selected.name}</span>
            <span className="text-muted-foreground text-xs">{formatBytes(selected.size)}</span>
          </div>
        ) : (
          <span className="text-muted-foreground text-sm">
            {t(
              'pages.documentGeneration.templates.form.dropFileOrClick',
              'Drop a .docx file here or click to choose'
            )}
          </span>
        )}
      </div>
    )
  }

  const unknownVariablesBlock = (vars: string[]) => (
    <div className="border-warning-200 bg-warning-50 text-warning-800 flex flex-col gap-1 rounded-md border p-3 text-xs">
      <div className="flex items-center gap-1.5 font-semibold">
        <Icons.Warning size={14} strokeWidth={2} />
        {t(
          'pages.documentGeneration.templates.warnings.unknownVariablesTitle',
          'Variables outside the dictionary'
        )}
      </div>
      <p className="text-warning-700">
        {t(
          'pages.documentGeneration.templates.warnings.unknownVariablesHelp',
          'These placeholders are not in the dictionary and will not be substituted:'
        )}
      </p>
      <div className="flex flex-wrap gap-1">
        {vars.map((v) => (
          <code
            key={v}
            className="border-warning-300 bg-warning-100 rounded border px-1.5 py-0.5 text-[11px]"
          >{`{{${v}}}`}</code>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="bg-overlay fixed inset-0 z-50 backdrop-blur-xl" />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className={cn(
                'bg-card relative z-50 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg shadow-xl',
                'max-w-[95%] sm:max-w-3xl md:max-w-5xl lg:max-w-6xl'
              )}
            >
              {/* Header */}
              <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <DialogPrimitive.Title className="text-foreground text-base font-semibold sm:text-lg">
                    {title}
                  </DialogPrimitive.Title>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t(
                      'pages.documentGeneration.templates.modals.subtitle',
                      'Use {{variable_name}} to insert dynamic data.'
                    )}
                  </p>
                </div>
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    aria-label={t('actions.close', 'Close')}
                    className="hover:bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                  >
                    <Icon
                      icon={Cancel01Icon}
                      size={18}
                      className="text-foreground"
                      strokeWidth={1.5}
                    />
                  </button>
                </DialogPrimitive.Close>
              </div>

              {uploadWarning ? (
                /* Terminal screen after a docx upload that had unknown variables. */
                <>
                  <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 sm:px-6">
                    {unknownVariablesBlock(uploadWarning)}
                  </div>
                  <div className="border-border flex items-center justify-end border-t px-4 py-3 sm:px-6">
                    <Button onClick={onClose} className="w-full sm:w-auto">
                      {t('pages.documentGeneration.templates.warnings.acknowledge', 'Done')}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-3 sm:px-6 sm:py-4 lg:flex-row">
                    <div className="flex min-w-0 flex-1 flex-col gap-4">
                      {/* Kind switcher — create only. */}
                      {!isEdit && (
                        <div className="flex flex-col gap-1.5">
                          <Label>
                            {t(
                              'pages.documentGeneration.templates.templateKind.label',
                              'Template type'
                            )}
                          </Label>
                          <RadioGroup
                            value={templateKind}
                            onValueChange={(v) => setTemplateKind(v as DocumentTemplateKind)}
                            className="grid-cols-3 gap-2 sm:inline-grid"
                          >
                            {(['text', 'compose', 'docx'] as CreateKind[]).map((kind) => {
                              const id = `dt-kind-${kind}`
                              return (
                                <div
                                  key={kind}
                                  className={cn(
                                    'flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                                    templateKind === kind
                                      ? 'border-primary-400 bg-primary-50/50'
                                      : 'border-border hover:bg-muted'
                                  )}
                                >
                                  <RadioItem id={id} value={kind} />
                                  <Label htmlFor={id} className="mb-0 cursor-pointer font-normal">
                                    {kind === 'text'
                                      ? t(
                                          'pages.documentGeneration.templates.templateKind.text',
                                          'Text template'
                                        )
                                      : kind === 'compose'
                                        ? t(
                                            'pages.documentGeneration.templates.templateKind.compose',
                                            'Фірмовий бланк'
                                          )
                                        : t(
                                            'pages.documentGeneration.templates.templateKind.docx',
                                            '.docx file'
                                          )}
                                  </Label>
                                </div>
                              )
                            })}
                          </RadioGroup>
                        </div>
                      )}

                      {/* Name */}
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="dt-name">
                          {t('pages.documentGeneration.templates.form.name', 'Template name')}
                        </Label>
                        <Input
                          id="dt-name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t(
                            'pages.documentGeneration.templates.form.namePlaceholder',
                            'e.g. Demand letter'
                          )}
                          maxLength={200}
                        />
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="dt-description">
                          {t('pages.documentGeneration.templates.form.description', 'Description')}
                        </Label>
                        <Input
                          id="dt-description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder={t(
                            'pages.documentGeneration.templates.form.descriptionPlaceholder',
                            'Optional short description'
                          )}
                          maxLength={500}
                        />
                      </div>

                      {/* Activation rule — gates when the template is offered for generation. */}
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="dt-activation-rule">
                          {t(
                            'pages.documentGeneration.templates.form.activationRule',
                            'Activation rule'
                          )}
                        </Label>
                        <Select
                          value={activationRule}
                          onValueChange={(v) => setActivationRule(v as DocumentActivationRule)}
                        >
                          <SelectTrigger id="dt-activation-rule" className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACTIVATION_RULES.map((rule) => (
                              <SelectItem key={rule} value={rule}>
                                {activationRuleLabel(rule)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Activation tag — required when the rule is `tag_active`. */}
                      {requiresActivationTag && (
                        <div className="flex flex-col gap-1">
                          <Label htmlFor="dt-activation-tag">
                            {t(
                              'pages.documentGeneration.templates.form.activationTag',
                              'Тег активації'
                            )}
                            <span className="text-error-500 ml-1">*</span>
                          </Label>
                          <Select
                            value={activationTagId == null ? '' : String(activationTagId)}
                            onValueChange={(v) => setActivationTagId(v ? Number(v) : null)}
                          >
                            <SelectTrigger id="dt-activation-tag" className="w-full">
                              <SelectValue
                                placeholder={t(
                                  'pages.documentGeneration.templates.form.activationTagPlaceholder',
                                  'Оберіть тег'
                                )}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {(activationTags ?? []).map((tag) => (
                                <SelectItem key={tag.id} value={String(tag.id)}>
                                  {tag.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <p className="text-muted-foreground text-xs">
                            {t(
                              'pages.documentGeneration.templates.form.activationTagHelp',
                              'Шаблон буде доступний лише клієнтам із цим тегом.'
                            )}
                          </p>
                        </div>
                      )}

                      {/* Document type auto-applied on generation (CEO 24.07). */}
                      <div className="flex flex-col gap-1">
                        <Label htmlFor="dt-doc-type">
                          {t(
                            'pages.documentGeneration.templates.form.documentType',
                            'Тип документа (для генерації)'
                          )}
                        </Label>
                        <Select
                          value={documentTypeId == null ? '' : String(documentTypeId)}
                          onValueChange={(v) => setDocumentTypeId(v ? Number(v) : null)}
                        >
                          <SelectTrigger id="dt-doc-type" className="w-full">
                            <SelectValue
                              placeholder={t(
                                'pages.documentGeneration.templates.form.documentTypePlaceholder',
                                'Не задано — оператор обере вручну'
                              )}
                            >
                              {(() => {
                                const selected = (documentTypes ?? []).find(
                                  (dt) => dt.id === documentTypeId
                                )
                                return selected ? (
                                  <DocumentTypePill name={selected.name} hex={selected.color} />
                                ) : null
                              })()}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {(documentTypes ?? []).map((type) => (
                              <SelectItem key={type.id} value={String(type.id)}>
                                <DocumentTypePill name={type.name} hex={type.color} />
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* is_active — docx edit only. */}
                      {isEdit && templateKind === 'docx' && (
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor="dt-active" className="mb-0">
                            {t('pages.documentGeneration.templates.form.isActive', 'Active')}
                          </Label>
                          <ToggleSwitch
                            checked={isActive}
                            onChange={setIsActive}
                            ariaLabel={t(
                              'pages.documentGeneration.templates.form.isActive',
                              'Active'
                            )}
                          />
                        </div>
                      )}

                      {templateKind === 'compose' ? (
                        <>
                          <p className="text-muted-foreground text-xs">
                            {t(
                              'pages.documentGeneration.templates.form.composeHelp',
                              'Шапка з лого, реквізити компанії, печатка та підпис додаються автоматично.'
                            )}
                          </p>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="dt-compose-title">
                              {t(
                                'pages.documentGeneration.templates.form.composeTitle',
                                'Заголовок документа'
                              )}
                            </Label>
                            <Input
                              id="dt-compose-title"
                              value={composeTitle}
                              onChange={(e) => setComposeTitle(e.target.value)}
                              placeholder={t(
                                'pages.documentGeneration.templates.form.composeTitlePlaceholder',
                                'напр. ГАРАНТІЙНИЙ ЛИСТ'
                              )}
                              maxLength={300}
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="dt-compose-body">
                              {t('pages.documentGeneration.templates.form.body', 'Template body')}
                            </Label>
                            <Textarea
                              id="dt-compose-body"
                              ref={textareaRef}
                              value={body}
                              onChange={(e) => setBody(e.target.value)}
                              placeholder={t(
                                'pages.documentGeneration.templates.form.composeBodyPlaceholder',
                                'Кожен рядок — окремий абзац. Вставляйте змінні з панелі праворуч.'
                              )}
                              rows={10}
                              className="min-h-[200px]"
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={includeRequisites}
                                onChange={(e) => setIncludeRequisites(e.target.checked)}
                                className="accent-primary-500 h-4 w-4"
                              />
                              {t(
                                'pages.documentGeneration.templates.form.includeRequisites',
                                'Реквізити для оплати'
                              )}
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={includeSchedule}
                                onChange={(e) => setIncludeSchedule(e.target.checked)}
                                className="accent-primary-500 h-4 w-4"
                              />
                              {t(
                                'pages.documentGeneration.templates.form.includeSchedule',
                                'Таблиця графіка платежів (РР)'
                              )}
                            </label>
                          </div>
                        </>
                      ) : templateKind === 'text' ? (
                        <>
                          {/* Body */}
                          <div className="flex flex-col gap-1">
                            <Label htmlFor="dt-body">
                              {t('pages.documentGeneration.templates.form.body', 'Template body')}
                            </Label>
                            <Textarea
                              id="dt-body"
                              ref={textareaRef}
                              value={body}
                              onChange={(e) => setBody(e.target.value)}
                              placeholder={t(
                                'pages.documentGeneration.templates.form.bodyPlaceholder',
                                'Compose your template here. Insert variables from the right-hand panel.'
                              )}
                              rows={8}
                              className="min-h-[160px] sm:min-h-[200px]"
                            />
                          </div>

                          {/* Preview */}
                          <div className="flex flex-col gap-1">
                            <Label>
                              {t(
                                'pages.documentGeneration.templates.form.preview',
                                'Preview (sample data)'
                              )}
                            </Label>
                            <div className="border-border bg-muted text-foreground min-h-[100px] rounded-md border border-dashed px-3 py-2 text-sm whitespace-pre-wrap sm:min-h-[120px]">
                              {previewText.trim() ? (
                                previewText
                              ) : (
                                <span className="text-muted-foreground">
                                  {t(
                                    'pages.documentGeneration.templates.form.previewEmpty',
                                    'Start typing to see a live preview.'
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : isEdit ? (
                        <>
                          {/* Docx edit: read-only body preview + replace + download. */}
                          <div className="flex flex-col gap-1">
                            <Label>
                              {t(
                                'pages.documentGeneration.templates.form.bodyReadonly',
                                'Body (from file, read-only)'
                              )}
                            </Label>
                            <div className="border-border bg-muted text-foreground max-h-[220px] min-h-[100px] overflow-y-auto rounded-md border border-dashed px-3 py-2 text-sm whitespace-pre-wrap">
                              {body.trim() ? (
                                body
                              ) : (
                                <span className="text-muted-foreground">
                                  {t(
                                    'pages.documentGeneration.templates.form.bodyEmpty',
                                    'No extracted text.'
                                  )}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <Label className="mb-0">
                                {t(
                                  'pages.documentGeneration.templates.form.currentFile',
                                  'Current file'
                                )}
                              </Label>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleDownload}
                                leftIcon={<Icons.Download size={14} strokeWidth={1.5} />}
                              >
                                {t(
                                  'pages.documentGeneration.templates.form.downloadFile',
                                  'Download file'
                                )}
                              </Button>
                            </div>
                            {template?.file_name && (
                              <p className="text-muted-foreground text-xs">
                                {template.file_name}
                                {template.file_size != null &&
                                  ` · ${formatBytes(template.file_size)}`}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-col gap-2">
                            <Label className="mb-0">
                              {t(
                                'pages.documentGeneration.templates.form.replaceFile',
                                'Replace file'
                              )}
                            </Label>
                            {renderDropZone(replaceFile, setReplaceFile, 'dt-replace-file')}
                            {replaceWarning && unknownVariablesBlock(replaceWarning)}
                            <div>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={handleReplace}
                                disabled={!replaceFile || submitting}
                              >
                                {replaceMutation.isPending
                                  ? t('actions.saving', 'Saving…')
                                  : t(
                                      'pages.documentGeneration.templates.form.replaceAction',
                                      'Replace file'
                                    )}
                              </Button>
                            </div>
                          </div>

                          {/* How it will look (sample data) — collapsed by default. */}
                          <div className="border-border flex flex-col gap-2 border-t pt-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <Label className="mb-0">
                                {t(
                                  'pages.documentGeneration.templates.preview.sampleSectionTitle',
                                  'How it will look (sample data)'
                                )}
                              </Label>
                              <div className="flex items-center gap-2">
                                {sampleExpanded && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setPreviewFullscreen(true)}
                                    leftIcon={<Icons.Eye size={14} strokeWidth={1.5} />}
                                  >
                                    {t(
                                      'pages.documentGeneration.templates.preview.openFullscreen',
                                      'Open fullscreen'
                                    )}
                                  </Button>
                                )}
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setSampleExpanded((v) => !v)}
                                  leftIcon={
                                    sampleExpanded ? (
                                      <Icons.ArrowUp size={14} strokeWidth={1.5} />
                                    ) : (
                                      <Icons.ArrowDown size={14} strokeWidth={1.5} />
                                    )
                                  }
                                >
                                  {sampleExpanded
                                    ? t('pages.documentGeneration.templates.preview.hide', 'Hide')
                                    : t('pages.documentGeneration.templates.preview.show', 'Show')}
                                </Button>
                              </div>
                            </div>
                            {sampleExpanded && (
                              <div className="border-border h-[50vh] overflow-hidden rounded-md border">
                                <DocumentFileViewer
                                  title={name}
                                  blob={sampleBlob ?? null}
                                  isLoading={sampleLoading}
                                  error={sampleError}
                                />
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <>
                          {/* Docx create: file picker. */}
                          <div className="flex flex-col gap-1">
                            <Label>
                              {t('pages.documentGeneration.templates.form.file', '.docx file')}
                            </Label>
                            {renderDropZone(file, setFile, 'dt-file')}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Right column: variables panel */}
                    {renderVariablesPanel(
                      templateKind === 'text' || templateKind === 'compose' ? 'insert' : 'reference'
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-border flex flex-col-reverse items-stretch gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:px-6">
                    <Button
                      variant="secondary"
                      onClick={onClose}
                      disabled={submitting}
                      className="w-full sm:w-auto"
                    >
                      {t('actions.cancel', 'Cancel')}
                    </Button>
                    <Button
                      onClick={handlePrimarySubmit}
                      disabled={submitting}
                      className="w-full sm:w-auto"
                    >
                      {submitting
                        ? t('actions.saving', 'Saving…')
                        : isEdit
                          ? t('actions.save', 'Save')
                          : t('actions.create', 'Create')}
                    </Button>
                  </div>
                </>
              )}
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {previewFullscreen && template && (
        <TemplatePreviewModal
          open={previewFullscreen}
          template={template}
          initialMode="sample"
          onClose={() => setPreviewFullscreen(false)}
        />
      )}
    </>
  )
}
