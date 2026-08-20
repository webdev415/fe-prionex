/**
 * Profile Settings → Keyboard Shortcuts (KAN-975).
 *
 * Where an operator binds their own key combinations to TA templates. Until
 * this screen existed the bindings could only be set by editing the database,
 * which made the quick-launch feature (KAN-973) unusable by the people it was
 * built for.
 *
 * Per-operator throughout: the API reads the user from the token, so nothing
 * here takes or sends a user id, and two operators may bind the same keys to
 * different templates without knowing about each other.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import { getErrorMessage } from '@/lib/errors'
import { useAuthStore } from '@/stores/authStore'
import { useQuickPicks } from '@/features/quickPicks/hooks/useQuickPicks'
import type { QuickPick } from '@/features/quickPicks/api/types'
import { useTargetActions } from '@/features/targetActions/hooks/useTargetActions'
import { useTAChains } from '@/features/taChains/hooks/useTAChains'
import { useAssignTAHotkey, useClearTAHotkey, useTAHotkeyList } from '../hooks/useTAHotkeys'
import { findConflict } from '../shortcutRecorder'
import { ShortcutBadge } from './ShortcutBadge'
import { ShortcutRecorderBox } from './ShortcutRecorderBox'

export function KeyboardShortcutsSettings() {
  const { t } = useTranslation()

  // Same department rule as the client card's template picker: an operator sees
  // their own department's picks, while admins and default-role users (whose
  // roles ship with no department) see all of them. Diverging here would let
  // someone bind a key to a template they cannot run.
  const { user } = useAuthStore()
  const isAdmin = user?.permissions?.includes('manage_settings') ?? false
  const departmentId = user?.active_department_id ?? undefined
  const seesAllDepartments = isAdmin || departmentId === undefined

  const { data: quickPicks, isLoading: isLoadingPicks } = useQuickPicks(
    seesAllDepartments ? undefined : departmentId,
    { fetchAll: seesAllDepartments }
  )
  const { data: targetActionsData } = useTargetActions()
  // The department rule above is necessary but not sufficient. ChainExecutor
  // additionally keeps only quick picks whose chain is manual and active
  // (ChainExecutor.tsx: `useTAChains({ include_inactive: false })` then
  // `chain_type === 'manual'`), because those are the only chains it can
  // start. Without the same filter here the screen offers templates that
  // resolve on keypress, open the modal and then start nothing — a dead key
  // the operator was invited to bind. Same params as the executor so the two
  // lists cannot disagree.
  const {
    data: chainsData,
    isLoading: isLoadingChains,
    isError: chainsFailed,
    refetch: refetchChains,
  } = useTAChains({
    include_inactive: false,
    department_id: seesAllDepartments ? undefined : departmentId,
  })
  const {
    data: bindings,
    isError: bindingsFailed,
    isLoading: isLoadingBindings,
    refetch: refetchBindings,
  } = useTAHotkeyList()
  const assignMut = useAssignTAHotkey()
  const clearMut = useClearTAHotkey()

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [recorded, setRecorded] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const allTemplates = useMemo(() => quickPicks ?? [], [quickPicks])
  const bindingList = useMemo(() => bindings ?? [], [bindings])

  /** Chains the executor is able to start — see the `useTAChains` note above. */
  const launchableChainIds = useMemo(() => {
    const ids = new Set<number>()
    for (const c of chainsData?.items ?? []) {
      if (c.chain_type === 'manual') ids.add(c.id)
    }
    return ids
  }, [chainsData])

  // A failed chain fetch is not an empty chain list. The endpoint is permission
  // gated (`manage_settings` or `create_interactions`), so a 403 is reachable,
  // and filtering against the resulting empty set would hide every template
  // behind "No templates are available to you" — the same "error looks like
  // absence" fault the bindings banner exists to prevent. When the answer is
  // unknown, nothing is filtered and the banner says why.
  // Keyed on the data, not on `isError`: a query can also sit with no data and
  // no error (paused while offline, for one), and every such state has to mean
  // "unknown" rather than "empty".
  const launchableKnown = chainsData !== undefined

  // The second door into a binding: the assign panel's dropdown. Filtering the
  // list but not this would leave the dead templates one click further away
  // rather than gone.
  const assignableTemplates = useMemo(
    () => allTemplates.filter((tpl) => !launchableKnown || launchableChainIds.has(tpl.chain_id)),
    [allTemplates, launchableChainIds, launchableKnown]
  )

  /** Combination per template, for the row badges. */
  const hotkeyByPick = useMemo(() => {
    const map = new Map<number, string>()
    for (const b of bindingList) map.set(b.quick_pick_id, b.hotkey)
    return map
  }, [bindingList])

  // Built from every template, not the filtered set: a conflict warning has to
  // name the template that holds the combination even when the search has
  // hidden it, or it reads "Already used by #37".
  const nameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const tpl of allTemplates) map.set(tpl.id, templateLabel(tpl))
    return map
  }, [allTemplates])

  // Preset values are keyed by target-action id; the chips read "<action>:
  // <value>", so the names have to be looked up rather than shown as ids.
  const targetActionNameById = useMemo(() => {
    const map = new Map<number, string>()
    for (const ta of targetActionsData?.items ?? []) map.set(ta.id, ta.name)
    return map
  }, [targetActionsData])

  // Chips are wanted twice — to match against while searching, and to draw on
  // the row — so they are built once here rather than recomputed in both
  // places. The lowercased haystack rides along for the same reason.
  const rows = useMemo(
    () =>
      allTemplates.map((tpl) => {
        const chips = presetChips(tpl, targetActionNameById)
        return {
          tpl,
          chips,
          isLaunchable: !launchableKnown || launchableChainIds.has(tpl.chain_id),
          haystack: [templateLabel(tpl), tpl.chain_name ?? '', ...chips].join(' ').toLowerCase(),
        }
      }),
    [allTemplates, targetActionNameById, launchableChainIds, launchableKnown]
  )

  // Two filters, for two different reasons.
  //
  // Search: a department can hold 50+ templates, which is more than anyone
  // will scroll to find one. Matching the stage and the preset chips as well
  // as the name means "messenger" or "refusal" finds a row even when the
  // operator only remembers what the template does, not what it was called.
  //
  // Launchability: templates the executor cannot start are dropped — except
  // when one still holds a combination. A chain deactivated after the binding
  // was made would otherwise take its shortcut off the screen while the server
  // still honours it: the operator could neither see nor clear it, and would
  // meet it again as a surprise `reassigned_from` the next time they recorded
  // those keys. Showing the row is what makes Remove reachable.
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((row) => {
      if (!row.isLaunchable && !hotkeyByPick.has(row.tpl.id)) return false
      return q ? row.haystack.includes(q) : true
    })
  }, [rows, search, hotkeyByPick])

  // Recording is closed while either half of the picture is missing.
  //
  // Without the bindings there is no way to tell "no shortcut" from "we could
  // not find out": every row reads as unassigned, no conflict warning can
  // fire, and saving silently takes a combination off a template the operator
  // was never warned about — they learn of it from the reassignment toast,
  // after the fact. Without the chains there is no way to tell whether the
  // template being bound is one the executor can even start.
  const assignPaused =
    bindingsFailed === true || isLoadingBindings === true || chainsFailed === true
  const loadFailed = bindingsFailed === true || chainsFailed === true

  const conflictId = recorded
    ? findConflict({ hotkey: recorded, editingQuickPickId: selectedId, bindings: bindingList })
    : null

  const resetPanel = () => {
    setSelectedId(null)
    setRecorded(null)
  }

  const startEditing = (quickPickId: number) => {
    setSelectedId(quickPickId)
    // Pre-fill with whatever that template already has, so re-recording is a
    // change rather than a fresh start (KAN-975 §3).
    setRecorded(hotkeyByPick.get(quickPickId) ?? null)
  }

  const handleSave = async () => {
    if (!selectedId || !recorded) return
    try {
      const result = await assignMut.mutateAsync({
        hotkey: recorded,
        quick_pick_id: selectedId,
      })
      // The server reports what actually moved, which can differ from the
      // warning shown here if the list was stale.
      if (result.reassigned_from != null) {
        toast.success(
          t('pages.profile.shortcuts.reassigned', {
            defaultValue: 'Shortcut moved from "{{name}}"',
            name: nameById.get(result.reassigned_from) ?? `#${result.reassigned_from}`,
          })
        )
      } else {
        toast.success(t('pages.profile.shortcuts.saved', 'Shortcut saved'))
      }
      resetPanel()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  const handleRemove = async (quickPickId: number) => {
    try {
      await clearMut.mutateAsync(quickPickId)
      if (selectedId === quickPickId) resetPanel()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <div className="flex w-full flex-col gap-5 self-stretch">
      <p className="text-muted-foreground text-sm">
        {t(
          'pages.profile.shortcuts.intro',
          "Assign a keyboard shortcut to any quick template you use often. Trigger the shortcut while on a client's profile page to open that Target Action (TA) modal instantly, adjust amount or date if needed, and save it — all without the mouse."
        )}
      </p>

      {/* Describes behaviour delivered by KAN-974; nothing here implements it. */}
      <div className="border-border bg-muted/40 flex items-start gap-3 rounded-lg border p-3">
        <Icons.Info size={18} strokeWidth={1.5} className="text-primary-500 mt-0.5 shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-foreground text-sm font-medium">
            {t('pages.profile.shortcuts.enterTitle', 'Enter saves the open modal')}
          </span>
          <span className="text-muted-foreground text-xs">
            {t(
              'pages.profile.shortcuts.enterBody',
              'Once a template modal is open — however it was opened — pressing Enter submits it, same as clicking Save, and required fields are still validated. Enter inserts a line break instead of saving while your cursor is in a comment field.'
            )}
          </span>
        </div>
      </div>

      {loadFailed && (
        <div
          role="alert"
          className="border-error-200 bg-error-50 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
        >
          <span className="text-error-700 text-sm">
            {t(
              'pages.profile.shortcuts.loadFailed',
              'Your saved shortcuts could not be loaded, so this list may be incomplete. Assigning is paused until it loads.'
            )}
          </span>
          <Button
            variant="white-secondary"
            onClick={() => {
              // Retry only what actually failed; refetching a healthy query
              // would spend a request to change nothing.
              if (bindingsFailed) void refetchBindings()
              if (chainsFailed) void refetchChains()
            }}
          >
            {t('actions.retry', 'Retry')}
          </Button>
        </div>
      )}

      <div className="flex w-full flex-col items-start gap-5 self-stretch xl:flex-row">
        {/* Template list */}
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('pages.profile.shortcuts.search', 'Search templates…')}
            className="w-full"
          />
          {/* The list scrolls inside itself rather than stretching the page.
              With 50+ templates the page grew tall enough that the assign panel
              beside it scrolled out of view, and the operator had to scroll back
              up to reach the box they had just clicked "+ Assign shortcut" for.
              Capping the list keeps both halves on screen together.

              Sized in rows rather than a fraction of the viewport: a row is
              about 88px, so this is roughly six of them, and it stays six on a
              short laptop screen where 60vh was barely four. The lower bound
              keeps it usable when the window is genuinely small. */}
          <div className="flex max-h-[min(560px,60vh)] min-h-[240px] flex-col gap-2 overflow-y-auto pr-1">
            {isLoadingPicks || isLoadingChains || isLoadingBindings ? (
              <span className="text-muted-foreground text-sm">{t('status.loading')}</span>
            ) : visibleRows.length === 0 ? (
              <span className="text-muted-foreground text-sm">
                {search.trim()
                  ? t('pages.profile.shortcuts.noMatches', 'No templates match your search.')
                  : t('pages.profile.shortcuts.noTemplates', 'No templates are available to you.')}
              </span>
            ) : (
              visibleRows.map(({ tpl, chips, isLaunchable }) => {
                const hotkey = hotkeyByPick.get(tpl.id)
                const isEditing = selectedId === tpl.id
                return (
                  <div
                    key={tpl.id}
                    className={cn(
                      'border-border bg-card flex flex-wrap items-center gap-3 rounded-lg border p-3',
                      isEditing && 'border-primary-500'
                    )}
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-foreground truncate text-sm font-medium">
                        {templateLabel(tpl)}
                      </span>
                      {tpl.chain_name && (
                        <span className="text-muted-foreground text-xs">
                          {t('pages.profile.shortcuts.stage', 'Stage')}: {tpl.chain_name}
                        </span>
                      )}
                      {!isLaunchable && (
                        <span className="text-warning-600 text-xs">
                          {t(
                            'pages.profile.shortcuts.notLaunchable',
                            'This chain is no longer available, so the shortcut will not open anything. Remove it to free the combination.'
                          )}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-1">
                        {chips.map((chip) => (
                          <span
                            key={chip}
                            className="border-border bg-muted text-muted-foreground rounded-full border px-2 py-0.5 text-[11px]"
                          >
                            {chip}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {hotkey ? (
                        <>
                          <ShortcutBadge hotkey={hotkey} />
                          {/* No Edit on a dead row — re-recording would only
                              move the combination onto another key that still
                              opens nothing. Remove stays, so the operator can
                              hand the keys back. */}
                          {isLaunchable && (
                            <button
                              type="button"
                              onClick={() => startEditing(tpl.id)}
                              disabled={assignPaused}
                              aria-label={t('common.edit', 'Edit')}
                              className="hover:bg-muted rounded-md p-1.5"
                            >
                              <Icons.PencilEdit02 size={16} strokeWidth={1.5} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemove(tpl.id)}
                            // Mutation state is shared, so `isPending` alone
                            // greys out every row's Remove while one is in
                            // flight. `variables` is the id being cleared.
                            disabled={clearMut.isPending && clearMut.variables === tpl.id}
                            aria-label={t('actions.remove', 'Remove')}
                            className="hover:bg-muted rounded-md p-1.5 disabled:opacity-50"
                          >
                            <Icons.Cancel01 size={16} strokeWidth={1.5} />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditing(tpl.id)}
                          disabled={assignPaused}
                          className="text-primary-600 hover:text-primary-700 text-xs font-medium disabled:opacity-50"
                        >
                          {t('pages.profile.shortcuts.assign', '+ Assign shortcut')}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Assign panel */}
        {/* Sticky from xl up: the list runs to 50+ rows, and a panel that
            scrolls away leaves the operator pressing "+ Assign shortcut" on a
            row and then hunting back up the page for the box to record into. */}
        <div className="border-border bg-card flex w-full shrink-0 flex-col gap-4 rounded-lg border p-4 xl:sticky xl:top-[88px] xl:w-[300px] xl:self-start">
          <div className="flex flex-col gap-1">
            <span className="text-foreground text-sm font-semibold">
              {t('pages.profile.shortcuts.assignTitle', 'Assign Shortcut')}
            </span>
            <span className="text-muted-foreground text-xs">
              {t(
                'pages.profile.shortcuts.assignHint',
                'Pick a template, then click below and press the key combination you want.'
              )}
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground text-sm">
              {t('pages.profile.shortcuts.template', 'Template')}
            </Label>
            <Select
              value={selectedId ? String(selectedId) : ''}
              onValueChange={(value) => startEditing(Number(value))}
              disabled={assignPaused}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={t('pages.profile.shortcuts.selectTemplate', 'Select a template…')}
                />
              </SelectTrigger>
              <SelectContent>
                {assignableTemplates.map((tpl) => (
                  <SelectItem key={tpl.id} value={String(tpl.id)}>
                    {templateLabel(tpl)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground text-sm">
              {t('pages.profile.shortcuts.shortcut', 'Shortcut')}
            </Label>
            <ShortcutRecorderBox
              // Remount per template: recording is local state, and carrying it
              // across a change would record onto the newly selected template.
              key={selectedId ?? 'none'}
              value={recorded}
              disabled={selectedId === null || assignPaused}
              onRecorded={setRecorded}
              onCancel={() =>
                setRecorded(selectedId ? (hotkeyByPick.get(selectedId) ?? null) : null)
              }
            />
            {conflictId != null && (
              <span className="text-warning-700 text-xs">
                {t('pages.profile.shortcuts.conflict', {
                  defaultValue: 'Already used by "{{name}}". Saving will reassign it here.',
                  name: nameById.get(conflictId) ?? `#${conflictId}`,
                })}
              </span>
            )}
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!selectedId || !recorded || assignMut.isPending || assignPaused}
            className="w-full"
          >
            {t('pages.profile.shortcuts.save', 'Save Shortcut')}
          </Button>
          <Button variant="white-secondary" onClick={resetPanel} className="w-full">
            {t('pages.profile.shortcuts.clear', 'Clear Selection')}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Quick picks may be unnamed, in which case the chain's name is the label. */
function templateLabel(tpl: QuickPick): string {
  return tpl.name ?? tpl.chain_name ?? `#${tpl.id}`
}

/**
 * The template's pre-filled values, as "<target action>: <value>" chips.
 *
 * This is what the mockup calls tags — they are not tags in the tagging sense,
 * they are the preset step values that make one template differ from another
 * ("Channel: Messenger", "Result: Agreement"). Unknown action ids are dropped
 * rather than shown as raw numbers.
 */
function presetChips(tpl: QuickPick, nameById: Map<number, string>): string[] {
  const presets = tpl.preset_values ?? {}
  return Object.entries(presets)
    .map(([actionId, value]) => {
      const name = nameById.get(Number(actionId))
      if (!name) return null
      // Several action names already end in a colon — "Клієнт: Результат",
      // "Підтип: Домовленість" — and appending another produced chips reading
      // "Клієнт: Результат: Домовленість". An en dash separates the value from
      // a name that is itself a path.
      return name.includes(':') ? `${name} — ${value}` : `${name}: ${value}`
    })
    .filter((chip): chip is string => chip !== null)
}
