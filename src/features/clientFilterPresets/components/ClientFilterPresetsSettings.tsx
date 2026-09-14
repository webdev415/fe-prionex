/**
 * "Filter Presets" tab in profile settings (#1100, Part 1).
 *
 * Two sections: the operator's saved presets as cards, and an editor that is
 * hidden until they choose to create or edit one. Presets are personal — this
 * screen never shows anyone else's.
 *
 * This file owns the shell — the list, open/close, save/delete and status. The
 * form itself is ClientFilterPresetEditor, which mounts only while something is
 * being edited.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { useConfirm } from '@/components/ui/useConfirm'
import { Icons } from '@/lib/icons'

import { isDuplicateNameError, useClientFilterPresets } from '../hooks/useClientFilterPresets'
import type { ClientFilterPreset, ClientFilterPresetParams } from '../types'
import { ClientFilterPresetEditor } from './ClientFilterPresetEditor'

/** How long the "Preset saved" confirmation stays up, per the ticket. */
const SAVED_NOTICE_MS = 1800

/** Why the name was rejected, or null when it was not. */
type NameError = 'required' | 'duplicate' | 'failed' | null

interface EditorState {
  /** null = creating a new preset; a number = editing that saved preset. */
  editingId: number | null
  name: string
  params: ClientFilterPresetParams
}

const emptyEditor = (): EditorState => ({ editingId: null, name: '', params: {} })

export function ClientFilterPresetsSettings() {
  const { t } = useTranslation('common')

  const {
    presets,
    isLoading,
    isError,
    create,
    update,
    remove: removePreset,
  } = useClientFilterPresets()
  const { confirm, confirmDialog } = useConfirm()
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [nameError, setNameError] = useState<NameError>(null)
  const [savedNotice, setSavedNotice] = useState(false)

  const openNew = () => {
    setEditor(emptyEditor())
    setNameError(null)
  }

  const openEdit = (preset: ClientFilterPreset) => {
    setEditor({ editingId: preset.id, name: preset.name, params: preset.params })
    setNameError(null)
  }

  const remove = async (preset: ClientFilterPreset) => {
    // Deleting a preset cannot be undone and the only affordance is a small
    // icon, so it asks first — the same treatment the employee-list templates
    // give their own delete.
    const confirmed = await confirm({
      title: t('pages.profile.presets.confirmDeleteTitle', 'Delete this preset?'),
      message: t('pages.profile.presets.confirmDeleteMessage', {
        defaultValue: '"{{name}}" will be removed. This cannot be undone.',
        name: preset.name,
      }),
      confirmLabel: t('actions.delete', 'Delete'),
      cancelLabel: t('actions.cancel', 'Cancel'),
      tone: 'danger',
    })
    if (!confirmed) return

    await removePreset(preset.id)
    // Deleting the preset being edited leaves the form describing something
    // that no longer exists, so the editor closes with it.
    setEditor((current) => (current?.editingId === preset.id ? null : current))
  }

  const save = async () => {
    if (!editor) return
    const name = editor.name.trim()
    if (!name) {
      // The ticket asks for the field to take focus and show a red border
      // rather than a toast — a validation message the operator cannot miss.
      setNameError('required')
      document.getElementById('preset-name')?.focus()
      return
    }
    // Names are how a preset is picked from the client list menu, so two with
    // the same one are indistinguishable there. Rejecting matches the
    // UniqueConstraint(user_id, name) the employee-list templates already carry.
    // Case-insensitive, and a preset is never a duplicate of itself.
    const clash = presets.some(
      (p) => p.id !== editor.editingId && p.name.trim().toLowerCase() === name.toLowerCase()
    )
    if (clash) {
      setNameError('duplicate')
      document.getElementById('preset-name')?.focus()
      return
    }
    setNameError(null)
    try {
      if (editor.editingId === null) await create(name, editor.params)
      else await update(editor.editingId, name, editor.params)
    } catch (error) {
      // The check above works off the list this screen has; the server holds
      // the constraint. A name saved on another device between the two lands
      // here, and says the same thing rather than failing silently.
      if (isDuplicateNameError(error)) {
        setNameError('duplicate')
        document.getElementById('preset-name')?.focus()
        return
      }
      setNameError('failed')
      return
    }
    setSavedNotice(true)
    window.setTimeout(() => setSavedNotice(false), SAVED_NOTICE_MS)
  }

  /** Resets every filter value but keeps the name the operator has typed. */
  const clearFields = () => {
    setEditor((current) => (current ? { ...current, params: {} } : current))
  }

  return (
    <div className="flex w-full flex-col items-start gap-6 self-stretch">
      {confirmDialog}
      <div className="flex w-full flex-col items-start gap-3 self-stretch">
        <div className="flex w-full items-center justify-between gap-2 self-stretch">
          <span className="text-foreground text-base leading-[150%] font-medium tracking-[-0.36px]">
            {t('pages.profile.presets.title', 'Filter Presets')}
          </span>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Icons.Add size={16} />}
            onClick={openNew}
          >
            {t('pages.profile.presets.new', 'New preset')}
          </Button>
        </div>

        {isLoading ? (
          <div className="border-border text-muted-foreground w-full rounded-lg border border-dashed p-6 text-center text-sm">
            {t('pages.profile.presets.loading', 'Loading your presets…')}
          </div>
        ) : isError ? (
          // Distinct from "you have none": an operator told they have no
          // presets when the request merely failed might well create them again.
          <div className="border-border text-error-500 w-full rounded-lg border border-dashed p-6 text-center text-sm">
            {t('pages.profile.presets.loadFailed', 'Your presets could not be loaded.')}
          </div>
        ) : presets.length === 0 ? (
          <div className="border-border text-muted-foreground w-full rounded-lg border border-dashed p-6 text-center text-sm">
            {t(
              'pages.profile.presets.empty',
              'No presets yet. Create one to apply a set of client list filters in a single click.'
            )}
          </div>
        ) : (
          <ul className="flex w-full flex-col gap-2 self-stretch">
            {presets.map((preset) => (
              <li
                key={preset.id}
                className={
                  editor?.editingId === preset.id
                    ? 'border-primary-500 flex items-center justify-between gap-2 rounded-lg border p-3'
                    : 'border-border flex items-center justify-between gap-2 rounded-lg border p-3'
                }
              >
                {/* The card body is deliberately inert: the ticket opens the
                    editor only from the pencil, so a stray click on the card
                    cannot replace whatever is being edited. */}
                <span className="text-foreground truncate text-sm font-semibold">
                  {preset.name}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEdit(preset)}
                    aria-label={t('pages.profile.presets.edit', 'Edit preset')}
                    className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
                  >
                    <Icons.Edit02 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(preset)}
                    aria-label={t('pages.profile.presets.delete', 'Delete preset')}
                    className="text-muted-foreground hover:text-error-500 rounded-md p-1.5"
                  >
                    <Icons.Delete01 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editor && (
        <ClientFilterPresetEditor
          editingId={editor.editingId}
          name={editor.name}
          params={editor.params}
          nameError={nameError}
          saved={savedNotice}
          onNameChange={(name) => {
            setEditor({ ...editor, name })
            if (nameError) setNameError(null)
          }}
          onParamsChange={(params) => setEditor({ ...editor, params })}
          onSave={() => void save()}
          onClearFields={clearFields}
        />
      )}
    </div>
  )
}
