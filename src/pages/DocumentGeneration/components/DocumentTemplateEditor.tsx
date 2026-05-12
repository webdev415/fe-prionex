/**
 * Create / Edit modal for a Document Template (KAN-403 Tab 2).
 *
 * The body editor is a plain `<Textarea>`, mirroring the SMS Templates form:
 * the operator types/edits freely and clicks variables in the side panel to
 * splice `{{name}}` into the current cursor position.
 *
 * The component is unmounted when the modal closes, so we can rely on lazy
 * state initialisers — no useEffect needed to hydrate from props.
 */

import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Cancel01Icon, Icon } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import { cn } from '@/lib/utils'
import {
  useCreateDocumentTemplate,
  useUpdateDocumentTemplate,
  type DocumentTemplate,
} from '@/features/documents'
import { SAMPLE_VARIABLE_MAP, TEMPLATE_VARIABLES, substituteVariables } from './templateVariables'

interface Props {
  open: boolean
  onClose: () => void
  /** When provided, the modal is in edit mode. */
  template?: DocumentTemplate | null
}

const GROUP_ORDER: Array<'client' | 'credit' | 'system'> = ['client', 'credit', 'system']

export function DocumentTemplateEditor({ open, onClose, template }: Props) {
  const { t } = useTranslation('common')
  const isEdit = !!template

  // Lazy initialisers — populated once when the modal opens.
  const [name, setName] = useState(() => template?.name ?? '')
  const [body, setBody] = useState(() => template?.body ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const createMutation = useCreateDocumentTemplate()
  const updateMutation = useUpdateDocumentTemplate()
  const submitting = createMutation.isPending || updateMutation.isPending

  const previewText = useMemo(() => substituteVariables(body, SAMPLE_VARIABLE_MAP), [body])

  /** Insert `{{name}}` at the textarea's current cursor (replacing any selection). */
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
    // Restore focus + place caret after the inserted token.
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + token.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const handleSubmit = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(
        t('pages.documentGeneration.templates.errors.nameRequired', 'Template name is required')
      )
      return
    }
    if (!body.trim()) {
      toast.error(
        t('pages.documentGeneration.templates.errors.bodyRequired', 'Template body is required')
      )
      return
    }

    try {
      if (isEdit && template) {
        await updateMutation.mutateAsync({
          id: template.id,
          payload: { name: trimmedName, body },
        })
        toast.success(t('pages.documentGeneration.templates.messages.updated', 'Template updated'))
      } else {
        await createMutation.mutateAsync({ name: trimmedName, body })
        toast.success(t('pages.documentGeneration.templates.messages.created', 'Template created'))
      }
      onClose()
    } catch {
      // Error toast handled by the mutation's onError.
    }
  }

  const groupLabel = (g: 'client' | 'credit' | 'system'): string => {
    switch (g) {
      case 'client':
        return t('pages.documentGeneration.templates.variableGroups.client', 'Client')
      case 'credit':
        return t('pages.documentGeneration.templates.variableGroups.credit', 'Credit')
      case 'system':
        return t('pages.documentGeneration.templates.variableGroups.system', 'System')
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xl" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className={cn(
              'bg-light-50 relative z-50 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-lg shadow-xl',
              'max-w-[95%] sm:max-w-3xl md:max-w-5xl lg:max-w-6xl'
            )}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <DialogPrimitive.Title className="text-dark-500 text-lg font-semibold">
                  {isEdit
                    ? t('pages.documentGeneration.templates.modals.editTitle', 'Edit template')
                    : t('pages.documentGeneration.templates.modals.createTitle', 'Create template')}
                </DialogPrimitive.Title>
                <p className="mt-1 text-xs text-gray-500">
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
                  className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-gray-100"
                >
                  <Icon icon={Cancel01Icon} size={18} className="text-dark-500" strokeWidth={1.5} />
                </button>
              </DialogPrimitive.Close>
            </div>

            {/* Body */}
            <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-4 lg:flex-row">
              {/* Left column: name + textarea + preview */}
              <div className="flex flex-1 flex-col gap-4">
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
                    rows={10}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label>
                    {t('pages.documentGeneration.templates.form.preview', 'Preview (sample data)')}
                  </Label>
                  <div className="min-h-[120px] rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm whitespace-pre-wrap text-gray-800">
                    {previewText.trim() ? (
                      previewText
                    ) : (
                      <span className="text-gray-400">
                        {t(
                          'pages.documentGeneration.templates.form.previewEmpty',
                          'Start typing to see a live preview.'
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right column: variables panel */}
              <aside className="w-full shrink-0 rounded-lg border border-gray-200 bg-white p-3 lg:w-72">
                <h3 className="text-dark-500 mb-2 text-sm font-semibold">
                  {t('pages.documentGeneration.templates.form.variables', 'Variables')}
                </h3>
                <p className="mb-3 text-xs text-gray-500">
                  {t(
                    'pages.documentGeneration.templates.form.variablesHelp',
                    'Click a variable to insert it at the cursor.'
                  )}
                </p>
                <div className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1">
                  {GROUP_ORDER.map((group) => {
                    const items = TEMPLATE_VARIABLES.filter((v) => v.group === group)
                    if (items.length === 0) return null
                    return (
                      <div key={group} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold tracking-wide text-gray-500 uppercase">
                          {groupLabel(group)}
                        </span>
                        <div className="flex flex-col gap-1">
                          {items.map((v) => (
                            <button
                              key={v.name}
                              type="button"
                              onClick={() => handleInsert(v.name)}
                              className="hover:bg-primary-50 hover:border-primary-300 flex flex-col items-start gap-0.5 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-left text-xs transition-colors"
                            >
                              <code className="text-primary-700 text-[11px]">{`{{${v.name}}}`}</code>
                              <span className="text-[11px] leading-tight text-gray-600">
                                {t(v.descriptionKey, v.fallback)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </aside>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-3">
              <Button variant="secondary" onClick={onClose} disabled={submitting}>
                {t('actions.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting
                  ? t('actions.saving', 'Saving…')
                  : isEdit
                    ? t('actions.save', 'Save')
                    : t('actions.create', 'Create')}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
