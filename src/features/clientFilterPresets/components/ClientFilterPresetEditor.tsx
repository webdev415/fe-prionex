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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useAuth } from '@/features/auth'
import { buildChainStepOptions } from '@/pages/ClientManagement/components/chainStepOptions'

import { usePresetFilterOptions } from '../hooks/usePresetFilterOptions'
import type { ClientFilterPresetParams } from '../types'
import { PresetDateRangeRow } from './PresetDateRangeRow'
import { PresetEmployeeScopeRow } from './PresetEmployeeScopeRow'
import { PresetMultiSelectRow } from './PresetMultiSelectRow'
import { PresetNumericRangeRow } from './PresetNumericRangeRow'
import { PresetTagsRow } from './PresetTagsRow'

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
  const { portfolios, tags, rrStatuses, chains, employees, interactionUsers, searchers } =
    usePresetFilterOptions(projectId)

  // Steps belong to the chosen chains, exactly as on the client list: with
  // several chains picked the list is their union, labelled per chain.
  const chainSteps = useMemo(() => {
    const chosen = params.chainIds ?? []
    return buildChainStepOptions(chains.filter((c) => chosen.includes(c.id)))
  }, [chains, params.chainIds])

  const stepOptions = useMemo(
    () => chainSteps.map((step) => ({ value: step.id, label: step.target_action_name ?? '' })),
    [chainSteps]
  )

  /**
   * Applies several parameters at once, dropping every key a row cleared. Two
   * rows need more than one key in a single update — tags carry include and
   * exclude, and a chain change has to prune the steps that went with the old
   * chains — and doing those as separate calls would write one onto a stale copy
   * of the other.
   */
  const patchParams = (patch: Partial<ClientFilterPresetParams>) => {
    const next: Record<string, unknown> = { ...params }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key]
      else next[key] = value
    }
    onParamsChange(next as ClientFilterPresetParams)
  }

  /** Sets one parameter, dropping the key entirely when the row clears it. */
  const setParam = <K extends keyof ClientFilterPresetParams>(
    key: K,
    value: ClientFilterPresetParams[K] | undefined
  ) => {
    patchParams({ [key]: value } as Partial<ClientFilterPresetParams>)
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

        <PresetMultiSelectRow
          label={t('pages.profile.presets.fields.portfolio', 'Portfolio')}
          options={portfolios}
          value={params.portfolioIds}
          onChange={(v) => setParam('portfolioIds', v)}
          testId="preset-portfolio"
        />
        <PresetMultiSelectRow
          label={t('pages.profile.presets.fields.rrStatus', 'Restructuring status')}
          options={rrStatuses}
          value={params.rrStatusIds}
          onChange={(v) => setParam('rrStatusIds', v)}
          testId="preset-rr-status"
        />
        <PresetMultiSelectRow
          label={t('pages.profile.presets.fields.chain', 'TA chain')}
          options={chains.map((c) => ({ value: c.id, label: c.name }))}
          value={params.chainIds}
          onChange={(chainIds) => {
            // Steps belong to chains. Left alone, a step from a chain that is no
            // longer selected stays in the preset and silently narrows every
            // result it is applied to.
            const keep = buildChainStepOptions(
              chains.filter((c) => (chainIds ?? []).includes(c.id))
            ).map((s) => s.id)
            const survivors = (params.chainStepIds ?? []).filter((id) => keep.includes(id))
            patchParams({
              chainIds,
              chainStepIds: survivors.length > 0 ? survivors : undefined,
            })
          }}
          testId="preset-chain"
        />
        <PresetMultiSelectRow
          label={t('pages.profile.presets.fields.chainStep', 'Chain step')}
          options={stepOptions}
          value={params.chainStepIds}
          onChange={(v) => setParam('chainStepIds', v)}
          disabledHint={
            stepOptions.length === 0
              ? t('pages.profile.presets.fields.chainStepHint', 'Choose a chain first')
              : undefined
          }
          testId="preset-chain-step"
        />

        <fieldset className="flex w-full flex-col gap-2 self-stretch">
          <legend className="text-foreground text-sm font-medium">
            {t('pages.profile.presets.fields.responsibleSearcher', 'Responsible searcher')}
          </legend>
          <Select
            value={params.responsibleSearcher || undefined}
            onValueChange={(v) => setParam('responsibleSearcher', v === 'none' ? undefined : v)}
            onClear={() => setParam('responsibleSearcher', undefined)}
          >
            <SelectTrigger
              aria-label={t(
                'pages.profile.presets.fields.responsibleSearcher',
                'Responsible searcher'
              )}
            >
              <SelectValue placeholder={t('pages.profile.presets.multi.all', 'Any')} />
            </SelectTrigger>
            <SelectContent searchable>
              <SelectItem value="none">{t('pages.profile.presets.multi.all', 'Any')}</SelectItem>
              {searchers.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </fieldset>
      </div>

      <PresetTagsRow
        label={t('pages.profile.presets.fields.tags', 'Tags')}
        options={tags}
        include={params.tagIds}
        exclude={params.excludeTagIds}
        onChange={({ include, exclude }) =>
          patchParams({ tagIds: include, excludeTagIds: exclude })
        }
      />

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
