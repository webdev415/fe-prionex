/**
 * ChatTemplateSelect - «Шаблон прав чату» of the create role form (board
 * #1621, story 4). The chat set of a new role is copied once from the chosen
 * template; afterwards the switches of the edit form change it. Create only.
 *
 * Rendered only while the catalogue's chat lists are ready: without them
 * there is nothing honest to offer, and a field that is not shown cannot leak
 * a value into the request either (the role is then created not filled).
 * While the caller acts as another user the API refuses any template (every
 * one comes back not assignable): a note says so instead of nine options
 * that would all wrongly claim a HUB administrator is needed.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { Label } from '@/components/ui/Label'
import { chatTemplateLabel, type ChatCatalogView, type ChatRefusal } from '../chatRoleSet'
import { ChatRefusalNote } from './ChatSettingsSection'

interface ChatTemplateSelectProps {
  catalog: ChatCatalogView
  /** The select's value; `''` is "no template". */
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  refusal?: ChatRefusal | null
  /** The caller acts as another user: no template can be chosen. */
  impersonating?: boolean
}

export function ChatTemplateSelect({
  catalog,
  value,
  onChange,
  disabled = false,
  refusal = null,
  impersonating = false,
}: ChatTemplateSelectProps) {
  const { t } = useTranslation('common')
  const base = useId()
  const fieldId = `${base}-template`
  const hintId = `${base}-hint`
  const noteId = `${base}-note`

  // Any chat refusal of a create is the template's: it is the only chat field.
  const note = refusal && <ChatRefusalNote refusal={refusal} id={noteId} />

  if (impersonating) {
    return (
      <div>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.roles.chat.template.impersonating',
            'While acting as another user no chat template can be chosen: the role is created with the chat settings not filled.'
          )}
        </p>
        {note}
      </div>
    )
  }
  if (catalog.status !== 'ready') return note || null

  return (
    <div>
      <Label htmlFor={fieldId}>
        {t('pages.roles.chat.template.label', 'Chat permission template')}
        <span className="text-muted-foreground ml-1 text-sm font-light">
          {t('pages.roles.forms.optional')}
        </span>
      </Label>
      <select
        id={fieldId}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-describedby={refusal ? `${hintId} ${noteId}` : hintId}
        aria-invalid={refusal ? true : undefined}
        className="text-foreground border-border bg-card flex h-[45px] w-full items-center rounded-lg border px-3 py-2 text-sm font-light shadow-none focus:ring-0 focus:outline-none disabled:opacity-50"
      >
        <option value="">
          {t('pages.roles.chat.template.none', 'Not chosen — the chat settings stay not filled')}
        </option>
        {catalog.templates.map((template) => {
          const label = chatTemplateLabel(template.code)
          const name = label ? t(label.labelKey, label.fallback) : template.code
          return (
            <option key={template.code} value={template.code} disabled={!template.assignable}>
              {template.assignable
                ? name
                : `${name} (${t('pages.roles.chat.template.needsHubAdmin', 'a HUB administrator is required')})`}
            </option>
          )
        })}
      </select>
      <p id={hintId} className="text-muted-foreground mt-1 text-sm">
        {t(
          'pages.roles.chat.template.hint',
          'The chat permissions of the new role are copied from the template once; later the chat switches of the role change them.'
        )}
      </p>
      {note}
    </div>
  )
}
