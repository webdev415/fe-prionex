/**
 * The preset editor form (#1100, Part 1).
 *
 * Split out of ClientFilterPresetsSettings so it mounts only while a preset is
 * actually being edited — the employee options behind the "Selected employees"
 * scope come from the same hook the client list uses, and that hook is not
 * something a settings page should be paying for just by being open.
 *
 * Every row follows one rule: an unset filter is an *absent* key, never an
 * empty one. The row components enforce it by handing back `undefined`, and
 * `setParam` deletes on `undefined`, so a saved preset contains exactly the
 * filters the operator filled in.
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/features/auth'
import { useOperatorFilterOptions } from '@/pages/ClientManagement/hooks/useOperatorFilterOptions'

import type { ClientFilterPresetParams } from '../types'
import { PresetDateRangeRow } from './PresetDateRangeRow'
import { PresetEmployeeScopeRow } from './PresetEmployeeScopeRow'
import { PresetNumericRangeRow } from './PresetNumericRangeRow'

export interface ClientFilterPresetEditorProps {
  /** null = creating; a number = editing that saved preset. */
  editingId: number | null
  name: string
  params: ClientFilterPresetParams
  nameError: boolean
  saved: boolean
  onNameChange: (name: string) => void
  onParamsChange: (params: ClientFilterPresetParams) => void
  onSave: () => void
  onClearFields: () => void
  /**
   * Clock behind the resolved-date previews. Defaults to the moment the editor
   * opened; a prop so tests do not have to fake time globally.
   */
  now?: Date
}

export function ClientFilterPresetEditor({
  editingId,
  name,
  params,
  nameError,
  saved,
  onNameChange,
  onParamsChange,
  onSave,
  onClearFields,
  now,
}: ClientFilterPresetEditorProps) {
  const { t } = useTranslation('common')
  const { user } = useAuth()

  // One instant for the whole editing session, so the previews do not shift
  // under the operator between renders.
  const [mountedAt] = useState(() => new Date())
  const clock = now ?? mountedAt

  const projectId = user?.active_project_id ? Number(user.active_project_id) : null
  const { employeeOptions, interactionUserOptions } = useOperatorFilterOptions(projectId)

  const employees = useMemo(
    () => employeeOptions.map((o) => ({ id: o.id, name: o.name })),
    [employeeOptions]
  )
  const interactionUsers = useMemo(
    () => interactionUserOptions.map((o) => ({ id: o.id, name: o.name })),
    [interactionUserOptions]
  )

  /** Sets one parameter, dropping the key entirely when the row clears it. */
  const setParam = <K extends keyof ClientFilterPresetParams>(
    key: K,
    value: ClientFilterPresetParams[K] | undefined
  ) => {
    const next = { ...params }
    if (value === undefined) delete next[key]
    else next[key] = value
    onParamsChange(next)
  }

  return (
    <div className="border-border flex w-full flex-col items-start gap-4 self-stretch border-t pt-6">
      <span className="text-foreground self-stretch text-base leading-[150%] font-medium tracking-[-0.36px]">
        {editingId === null
          ? t('pages.profile.presets.newTitle', 'New preset')
          : t('pages.profile.presets.editTitle', 'Edit preset')}
      </span>

      <Input
        id="preset-name"
        label={t('pages.profile.presets.name', 'Preset name')}
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        error={
          nameError
            ? t('pages.profile.presets.nameRequired', 'Enter a name for the preset')
            : undefined
        }
      />

      <div className="grid w-full grid-cols-1 gap-5 self-stretch lg:grid-cols-2">
        <PresetNumericRangeRow
          label={t('pages.profile.presets.fields.totalDebt', 'Total debt')}
          value={params.totalDebt}
          onChange={(v) => setParam('totalDebt', v)}
        />
        <PresetNumericRangeRow
          label={t('pages.profile.presets.fields.principalDebt', 'Principal debt')}
          value={params.principalDebt}
          onChange={(v) => setParam('principalDebt', v)}
        />
        <PresetNumericRangeRow
          label={t('pages.profile.presets.fields.dpd', 'DPD')}
          value={params.dpd}
          onChange={(v) => setParam('dpd', v)}
        />

        <PresetDateRangeRow
          label={t('pages.profile.presets.fields.dateOfSale', 'Date of sale')}
          value={params.dateOfSale}
          onChange={(v) => setParam('dateOfSale', v)}
          now={clock}
        />
        <PresetDateRangeRow
          label={t('pages.profile.presets.fields.assignmentDate', 'Assignment date')}
          value={params.assignmentDate}
          onChange={(v) => setParam('assignmentDate', v)}
          now={clock}
        />
        <PresetDateRangeRow
          label={t('pages.profile.presets.fields.targetActionDate', 'Target action date')}
          value={params.targetActionDate}
          onChange={(v) => setParam('targetActionDate', v)}
          now={clock}
        />
        <PresetDateRangeRow
          label={t('pages.profile.presets.fields.interactionDate', 'Interaction date')}
          value={params.interactionDate}
          onChange={(v) => setParam('interactionDate', v)}
          now={clock}
        />

        <PresetEmployeeScopeRow
          label={t('pages.profile.presets.fields.interactionCreated', 'Interaction created by')}
          value={params.interactionCreated}
          onChange={(v) => setParam('interactionCreated', v)}
          options={interactionUsers}
        />
        <PresetEmployeeScopeRow
          label={t('pages.profile.presets.fields.responsibleEmployee', 'Responsible employee')}
          value={params.responsibleEmployee}
          onChange={(v) => setParam('responsibleEmployee', v)}
          options={employees}
        />
      </div>

      {/* Defaulted to on to match the client list, which reads an absent value
          as true — a box shown unticked here would apply as ticked. */}
      <label className="text-foreground flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={params.onlyLastChain ?? true}
          onCheckedChange={(checked) => setParam('onlyLastChain', checked === true)}
          aria-label={t('pages.profile.presets.fields.onlyLastChain', 'Only last TA chain')}
        />
        {t('pages.profile.presets.fields.onlyLastChain', 'Only last TA chain')}
      </label>

      <div className="flex w-full flex-wrap items-center gap-2 self-stretch">
        <Button variant="primary" size="sm" onClick={onSave}>
          {t('pages.profile.presets.save', 'Save preset')}
        </Button>
        <Button variant="secondary" size="sm" onClick={onClearFields}>
          {t('pages.profile.presets.clearFields', 'Clear all fields')}
        </Button>
        {saved && (
          <span role="status" className="text-success-500 text-sm font-medium">
            {t('pages.profile.presets.saved', 'Preset saved')}
          </span>
        )}
      </div>
    </div>
  )
}
