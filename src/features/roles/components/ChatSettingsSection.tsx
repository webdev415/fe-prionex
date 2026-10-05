/**
 * ChatSettingsSection - «Чат (HUB)» of the role forms (board #1621, story 4):
 * the eight chat switches and the role's screen.
 *
 * It only shows and collects values. What it shows is what the role's GET
 * returned (or what somebody set here since); which choices exist comes from
 * the catalogue; the rights behind the switches are computed by the API. The
 * only rule it applies is the API's own refusal by rule (see
 * `applySwitchChange` / `lockedSwitches`), so nobody assembles a combination
 * that would be refused anyway.
 */

import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import {
  SWITCH_KEYS,
  SWITCH_LABELS,
  applySwitchChange,
  clientDialogsLabel,
  homePlaneLabel,
  lockedSwitches,
  type ChatCatalogView,
  type ChatLabel,
  type ChatRefusal,
  type ChatRefusalReason,
  type SwitchKey,
  type ToggleKey,
} from '../chatRoleSet'
import type { ChatSwitches } from '../types'

const SELECT_CLASS =
  'text-foreground border-border bg-card flex h-[40px] w-full items-center rounded-lg border px-3 py-2 text-sm font-light shadow-none focus:ring-0 focus:outline-none disabled:opacity-50'

const REFUSAL_FALLBACKS: Readonly<Record<ChatRefusalReason, string>> = {
  invalid:
    'The chat switches were sent incomplete or with wrong values. Reload the page and try again.',
  conflict: 'These switches contradict chat access or «Chat only».',
  broken:
    'The stored chat set cannot be shown by these switches. Turn chat access off and save the role, then turn it on, set the switches and save again.',
  homePlaneUnknown: 'There is no such role screen.',
  templateUnknown: 'There is no such chat template.',
  templateImmutable: 'The chat template is chosen only when a role is created.',
  templateConflict: 'The chat template and the HUB chat role disagree on HUB administrator.',
  unknownHubRole: 'This HUB chat role would erase the chat settings of the role.',
  adminRequired: 'Only a HUB administrator of this project can make this chat change.',
  impersonating: 'While acting as another user the chat settings cannot be changed.',
}

/**
 * A chat refusal said in words at its field: the reason, then what it names.
 * An alert (announced at once), with an id the refused control points at.
 */
export function ChatRefusalNote({ refusal, id }: { refusal: ChatRefusal; id?: string }) {
  const { t } = useTranslation('common')
  const named = [
    ...refusal.switches.map((key) => t(SWITCH_LABELS[key].labelKey, SWITCH_LABELS[key].fallback)),
    ...refusal.others,
    ...(refusal.value !== null ? [refusal.value] : []),
  ]
  const reason = t(`pages.roles.chat.errors.${refusal.reason}`, REFUSAL_FALLBACKS[refusal.reason])
  return (
    <p id={id} role="alert" className="text-error-500 mt-1 text-sm">
      {named.length > 0 ? `${reason} (${named.join(', ')})` : reason}
    </p>
  )
}

/** The options of a select: the catalogue's, plus the current value if it is missing there. */
function withCurrent(options: ReadonlyArray<string>, current: string): string[] {
  return options.includes(current) ? [...options] : [...options, current]
}

interface ChatSettingsSectionProps {
  /** The switches shown; `null` = the role's chat set is not filled yet. */
  switches: ChatSwitches | null
  homePlane: string
  /** Controls instead of text (manage_roles, and the catalogue is ready). */
  editable: boolean
  catalog: ChatCatalogView
  /** `false` adds «Налаштування чату змінені вручну». */
  followsHubRole?: boolean
  /** The stored value is there but is not the eight switches: no fill offered. */
  unreadable?: boolean
  /** A draft was dropped because the stored values changed under the form. */
  outdated?: boolean
  /** Somebody is filling a role that is not filled (offers to cancel). */
  filling?: boolean
  onFill?: () => void
  onCancelFill?: () => void
  onChange?: (switches: ChatSwitches, homePlane: string) => void
  disabled?: boolean
  refusal?: ChatRefusal | null
  /** Why an edit form shows the values only. */
  readOnlyNote?: 'noRight' | 'impersonating' | 'catalogue' | null
}

export function ChatSettingsSection({
  switches,
  homePlane,
  editable,
  catalog,
  followsHubRole,
  unreadable = false,
  outdated = false,
  filling = false,
  onFill,
  onCancelFill,
  onChange,
  disabled = false,
  refusal = null,
  readOnlyNote = null,
}: ChatSettingsSectionProps) {
  const { t } = useTranslation('common')
  // Ids per instance: two forms may be mounted at once (a view and an edit).
  const base = useId()
  const ids = {
    title: `${base}-title`,
    dialogs: `${base}-dialogs`,
    plane: `${base}-plane`,
    planeHint: `${base}-plane-hint`,
    lock: `${base}-lock`,
    switchesNote: `${base}-switches-note`,
    screenNote: `${base}-screen-note`,
    hint: (key: string) => `${base}-hint-${key}`,
  }
  // A refusal of a field this section has no control for (a template one)
  // is said with the switches, so it is never left unsaid.
  const screenRefusal = refusal?.field === 'home_plane' ? refusal : null
  const switchesRefusal = refusal && !screenRefusal ? refusal : null
  const describedBy = (...parts: Array<string | false | null>) =>
    parts.filter(Boolean).join(' ') || undefined

  /** A code by its name, or as it is when this UI has none. */
  const named = (label: ChatLabel | null, code: string) =>
    label ? t(label.labelKey, label.fallback) : code
  const yesNo = (value: boolean) =>
    value ? t('pages.roles.chat.yes', 'Yes') : t('pages.roles.chat.no', 'No')

  const set = (next: ChatSwitches, plane: string) => onChange?.(next, plane)

  const controls = editable && switches !== null
  let body
  if (switches === null && unreadable) {
    body = (
      <p className="text-muted-foreground text-sm">
        {t(
          'pages.roles.chat.unreadable',
          'The stored chat settings of this role cannot be shown. They are left as they are; ask an administrator.'
        )}
      </p>
    )
  } else if (switches === null) {
    body = (
      <div>
        <p className="text-muted-foreground text-sm">
          {t(
            'pages.roles.chat.notFilled',
            'The chat settings of this role are not filled yet: HUB access still follows the old rules.'
          )}
        </p>
        {editable && onFill && (
          <button
            type="button"
            onClick={onFill}
            disabled={disabled}
            className="text-primary mt-2 text-sm font-medium hover:opacity-80 disabled:opacity-50"
          >
            {t('pages.roles.chat.fill', 'Fill in the chat settings')}
          </button>
        )}
      </div>
    )
  } else if (editable) {
    const locked = lockedSwitches(switches)
    const invalid = (key: SwitchKey) =>
      switchesRefusal !== null &&
      (switchesRefusal.switches.length === 0 || switchesRefusal.switches.includes(key))
    const describe = (key: SwitchKey) =>
      describedBy(ids.hint(key), locked.has(key) && ids.lock, switchesRefusal && ids.switchesNote)
    body = (
      <div className="space-y-3">
        {locked.size > 0 && (
          <p id={ids.lock} className="text-muted-foreground text-xs">
            {switches.access
              ? t(
                  'pages.roles.chat.lockedByChatOnly',
                  '«Chat only (bot)» sets the dialogues, groups, files, AI, lead rights and department channel admin itself; they cannot be changed while it is on.'
                )
              : t(
                  'pages.roles.chat.lockedByAccess',
                  'Chat access is off, so the other switches are off and cannot be changed.'
                )}
          </p>
        )}
        {SWITCH_KEYS.map((key) => {
          const label = SWITCH_LABELS[key]
          const name = t(label.labelKey, label.fallback)
          const hint = t(label.hint.labelKey, label.hint.fallback)
          const off = disabled || locked.has(key)
          if (key === 'client_dialogs') {
            return (
              <div key={key}>
                <label htmlFor={ids.dialogs} className="text-foreground text-sm font-light">
                  {name}
                </label>
                <select
                  id={ids.dialogs}
                  value={switches.client_dialogs}
                  disabled={off}
                  aria-describedby={describe(key)}
                  aria-invalid={invalid(key) || undefined}
                  onChange={(event) =>
                    set(
                      applySwitchChange(switches, 'client_dialogs', event.target.value),
                      homePlane
                    )
                  }
                  className={`${SELECT_CLASS} mt-1`}
                >
                  {withCurrent(catalog.clientDialogValues, switches.client_dialogs).map((code) => (
                    <option key={code} value={code}>
                      {named(clientDialogsLabel(code), code)}
                    </option>
                  ))}
                </select>
                <p id={ids.hint(key)} className="text-muted-foreground mt-1 text-xs">
                  {hint}
                </p>
              </div>
            )
          }
          const toggle = key as ToggleKey
          return (
            <div key={key} className="flex items-start justify-between gap-4">
              <div>
                <span className="text-foreground text-sm font-light">{name}</span>
                <p id={ids.hint(key)} className="text-muted-foreground text-xs">
                  {hint}
                </p>
              </div>
              <ToggleSwitch
                checked={switches[toggle]}
                disabled={off}
                ariaLabel={name}
                ariaDescribedBy={describe(key)}
                ariaInvalid={invalid(key)}
                onChange={(checked) => set(applySwitchChange(switches, toggle, checked), homePlane)}
              />
            </div>
          )
        })}
        {switchesRefusal && <ChatRefusalNote refusal={switchesRefusal} id={ids.switchesNote} />}
        <div>
          <label htmlFor={ids.plane} className="text-foreground text-sm font-light">
            {t('pages.roles.chat.homePlane', 'Role screen')}
          </label>
          <select
            id={ids.plane}
            value={homePlane}
            disabled={disabled}
            aria-describedby={describedBy(ids.planeHint, screenRefusal && ids.screenNote)}
            aria-invalid={screenRefusal ? true : undefined}
            onChange={(event) => set(switches, event.target.value)}
            className={`${SELECT_CLASS} mt-1`}
          >
            {withCurrent(catalog.homePlanes, homePlane).map((code) => (
              <option key={code} value={code}>
                {named(homePlaneLabel(code), code)}
              </option>
            ))}
          </select>
          <p id={ids.planeHint} className="text-muted-foreground mt-1 text-xs">
            {t('pages.roles.chat.homePlaneHint', 'The screen HUB opens for people with this role.')}
          </p>
          {screenRefusal && <ChatRefusalNote refusal={screenRefusal} id={ids.screenNote} />}
        </div>
        {filling && onCancelFill && (
          <button
            type="button"
            onClick={onCancelFill}
            disabled={disabled}
            className="text-muted-foreground text-sm hover:opacity-80 disabled:opacity-50"
          >
            {t('pages.roles.chat.cancelFill', 'Leave the chat settings not filled')}
          </button>
        )}
      </div>
    )
  } else {
    body = (
      <dl className="space-y-1">
        {SWITCH_KEYS.map((key) => {
          const label = SWITCH_LABELS[key]
          const value =
            key === 'client_dialogs'
              ? named(clientDialogsLabel(switches.client_dialogs), switches.client_dialogs)
              : yesNo(switches[key as ToggleKey])
          return (
            <div key={key} className="flex items-center gap-2">
              <dt className="text-muted-foreground text-sm font-light">
                {t(label.labelKey, label.fallback)}:
              </dt>
              <dd className="text-foreground text-sm font-semibold">{value}</dd>
            </div>
          )
        })}
        <div className="flex items-center gap-2">
          <dt className="text-muted-foreground text-sm font-light">
            {t('pages.roles.chat.homePlane', 'Role screen')}:
          </dt>
          <dd className="text-foreground text-sm font-semibold">
            {named(homePlaneLabel(homePlane), homePlane)}
          </dd>
        </div>
      </dl>
    )
  }

  return (
    <section aria-labelledby={ids.title} className="border-border rounded-xl border p-4">
      <h3 id={ids.title} className="text-foreground text-sm font-medium">
        {t('pages.roles.chat.title', 'Chat (HUB)')}
      </h3>
      <p className="text-muted-foreground mb-3 text-xs">
        {t('pages.roles.chat.hint', 'What people with this role may do in the HUB chat.')}
      </p>
      {followsHubRole === false && (
        <p className="text-muted-foreground mb-2 text-xs">
          {t('pages.roles.chat.editedByHand', 'The chat settings were changed by hand')}
        </p>
      )}
      {outdated && (
        <p role="status" className="text-warning-600 mb-2 text-xs">
          {t(
            'pages.roles.chat.outdated',
            'The chat settings of this role were changed meanwhile; your changes in this section were dropped and the stored values are shown.'
          )}
        </p>
      )}
      {body}
      {/* With controls the notes stand at their fields (above). */}
      {!controls && switchesRefusal && (
        <ChatRefusalNote refusal={switchesRefusal} id={ids.switchesNote} />
      )}
      {!controls && screenRefusal && (
        <ChatRefusalNote refusal={screenRefusal} id={ids.screenNote} />
      )}
      {readOnlyNote && (
        <p className="text-muted-foreground mt-2 text-xs">
          {readOnlyNote === 'noRight'
            ? t(
                'pages.roles.chat.readOnlyNoRight',
                'Only someone who manages the roles of this project can change the chat settings.'
              )
            : readOnlyNote === 'impersonating'
              ? t(
                  'pages.roles.chat.readOnlyImpersonating',
                  'While acting as another user the chat settings are shown only.'
                )
              : t(
                  'pages.roles.chat.readOnlyCatalogue',
                  'The values to choose from are not available right now, so the chat settings are shown only.'
                )}
        </p>
      )}
    </section>
  )
}
