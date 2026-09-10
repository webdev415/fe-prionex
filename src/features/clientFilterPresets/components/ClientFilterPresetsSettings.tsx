/**
 * "Filter Presets" tab in profile settings (#1100, Part 1).
 *
 * Two sections: the operator's saved presets as cards, and an editor that is
 * hidden until they choose to create or edit one. Presets are personal — this
 * screen never shows anyone else's.
 *
 * The editor's filter fields are added incrementally; this file owns the shell
 * (list, open/close, name, save/delete, status) so each filter row can land
 * separately without reworking the surrounding behaviour.
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'

import type { ClientFilterPreset, ClientFilterPresetParams } from '../types'

/** How long the "Preset saved" confirmation stays up, per the ticket. */
const SAVED_NOTICE_MS = 1800

interface EditorState {
  /** null = creating a new preset; a number = editing that saved preset. */
  editingId: number | null
  name: string
  params: ClientFilterPresetParams
}

const emptyEditor = (): EditorState => ({ editingId: null, name: '', params: {} })

export function ClientFilterPresetsSettings() {
  const { t } = useTranslation('common')

  // Local until the storage decision is made; the list and editor behaviour is
  // the same either way, so it is wired to state rather than blocked on it.
  const [presets, setPresets] = useState<ClientFilterPreset[]>([])
  const [editor, setEditor] = useState<EditorState | null>(null)
  const [nameError, setNameError] = useState(false)
  const [savedNotice, setSavedNotice] = useState(false)

  const openNew = () => {
    setEditor(emptyEditor())
    setNameError(false)
  }

  const openEdit = (preset: ClientFilterPreset) => {
    setEditor({ editingId: preset.id, name: preset.name, params: preset.params })
    setNameError(false)
  }

  const remove = (id: number) => {
    setPresets((current) => current.filter((p) => p.id !== id))
    // Deleting the preset being edited leaves the form describing something
    // that no longer exists, so the editor closes with it.
    setEditor((current) => (current?.editingId === id ? null : current))
  }

  const save = () => {
    if (!editor) return
    const name = editor.name.trim()
    if (!name) {
      // The ticket asks for the field to take focus and show a red border
      // rather than a toast — a validation message the operator cannot miss.
      setNameError(true)
      document.getElementById('preset-name')?.focus()
      return
    }
    setNameError(false)
    setPresets((current) =>
      editor.editingId === null
        ? [...current, { id: Date.now(), name, params: editor.params }]
        : current.map((p) =>
            p.id === editor.editingId ? { ...p, name, params: editor.params } : p
          )
    )
    setSavedNotice(true)
    window.setTimeout(() => setSavedNotice(false), SAVED_NOTICE_MS)
  }

  /** Resets every filter value but keeps the name the operator has typed. */
  const clearFields = () => {
    setEditor((current) => (current ? { ...current, params: {} } : current))
  }

  return (
    <div className="flex w-full flex-col items-start gap-6 self-stretch">
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

        {presets.length === 0 ? (
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
                    onClick={() => remove(preset.id)}
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
        <div className="border-border flex w-full flex-col items-start gap-4 self-stretch border-t pt-6">
          <span className="text-foreground self-stretch text-base leading-[150%] font-medium tracking-[-0.36px]">
            {editor.editingId === null
              ? t('pages.profile.presets.newTitle', 'New preset')
              : t('pages.profile.presets.editTitle', 'Edit preset')}
          </span>

          <Input
            id="preset-name"
            label={t('pages.profile.presets.name', 'Preset name')}
            value={editor.name}
            onChange={(e) => {
              setEditor({ ...editor, name: e.target.value })
              if (nameError) setNameError(false)
            }}
            error={
              nameError
                ? t('pages.profile.presets.nameRequired', 'Enter a name for the preset')
                : undefined
            }
          />

          <div className="flex w-full flex-wrap items-center gap-2 self-stretch">
            <Button variant="primary" size="sm" onClick={save}>
              {t('pages.profile.presets.save', 'Save preset')}
            </Button>
            <Button variant="secondary" size="sm" onClick={clearFields}>
              {t('pages.profile.presets.clearFields', 'Clear all fields')}
            </Button>
            {savedNotice && (
              <span role="status" className="text-success-500 text-sm font-medium">
                {t('pages.profile.presets.saved', 'Preset saved')}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
