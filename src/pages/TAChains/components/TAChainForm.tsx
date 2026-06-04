/**
 * TA Chain create/edit form (KAN-318).
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Input } from '@/components/ui/Input'
import { Label } from '@/components/ui/Label'
import { Textarea } from '@/components/ui/Textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'
import { useCreateTAChain, useUpdateTAChain } from '@/features/taChains/hooks/useTAChains'
import type { ChainType, TAChain, TAChainStepIn } from '@/features/taChains/api/types'
import { useDepartments } from '@/features/departments/hooks/useDepartments'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/lib/errors'
import { ChainStepsEditor } from './ChainStepsEditor'

interface TAChainFormProps {
  formId: string
  initial?: TAChain
  onSuccess: () => void
}

const CHAIN_TYPES: ChainType[] = ['manual', 'automatic']

export function TAChainForm({ formId, initial, onSuccess }: TAChainFormProps) {
  const { t } = useTranslation('common')
  const { user } = useAuthStore()
  const projectId = user?.active_project_id ? parseInt(user.active_project_id) : undefined
  const { data: departmentsData } = useDepartments({
    project_id: projectId,
    is_active: true,
    page_size: 100,
  })
  const departments = useMemo(() => departmentsData?.departments ?? [], [departmentsData])

  const createMut = useCreateTAChain()
  const updateMut = useUpdateTAChain()

  const isEdit = !!initial
  // KAN-XXX — once any operator has recorded a TA against this chain
  // the BE refuses changes to `steps` / `chain_type`, because retyping
  // a step (e.g. ``date`` → ``amount``) would silently rewrite history.
  // Mirror that gate in the form: keep name/description/department
  // editable, but freeze the structural fields and show a banner with
  // the "Clone to modify" path. Boolean only — see the BE notes on why
  // we don't fetch a precise interaction count.
  const isLocked = !!initial?.is_structurally_locked

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [chainType, setChainType] = useState<ChainType>(initial?.chain_type ?? 'manual')
  const [departmentIds, setDepartmentIds] = useState<number[]>(initial?.department_ids ?? [])
  const [isSystemHidden, setIsSystemHidden] = useState<boolean>(initial?.is_system_hidden ?? false)
  const [steps, setSteps] = useState<TAChainStepIn[]>(
    initial?.steps?.map((s) => ({
      target_action_id: s.target_action_id,
      is_required: s.is_required,
      delay_minutes: s.delay_minutes,
      not_in_the_past: s.not_in_the_past,
      contact_source: s.contact_source,
      contact_medium: s.contact_medium ?? 'phone',
    })) ?? []
  )

  const [deptOpen, setDeptOpen] = useState(false)
  const [deptSearch, setDeptSearch] = useState('')
  const filteredDepartments = useMemo(() => {
    const q = deptSearch.trim().toLowerCase()
    if (!q) return departments
    return departments.filter((d) => d.name.toLowerCase().includes(q))
  }, [departments, deptSearch])
  const departmentNameById = useMemo(() => {
    const m = new Map<number, string>()
    for (const d of departments) m.set(d.id, d.name)
    return m
  }, [departments])

  const toggleDepartment = (id: number) => {
    setDepartmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  const clearDepartments = () => setDepartmentIds([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('pages.taChains.errors.nameRequired'))
      return
    }
    if (departmentIds.length === 0) {
      toast.error(t('pages.taChains.errors.departmentRequired'))
      return
    }

    try {
      if (isEdit && initial) {
        // Omit ``chain_type`` and ``steps`` from the payload when the
        // chain is locked — sending them unchanged would still trigger
        // the BE's structural-changes-requested branch (and a 409).
        // Cosmetic fields are always sent.
        await updateMut.mutateAsync({
          id: initial.id,
          payload: isLocked
            ? {
                name: name.trim(),
                description: description || undefined,
                department_ids: departmentIds,
                is_system_hidden: isSystemHidden,
              }
            : {
                name: name.trim(),
                description: description || undefined,
                chain_type: chainType,
                department_ids: departmentIds,
                is_system_hidden: isSystemHidden,
                steps,
              },
        })
        toast.success(t('pages.taChains.toasts.updated'))
      } else {
        await createMut.mutateAsync({
          name: name.trim(),
          description: description || undefined,
          chain_type: chainType,
          department_ids: departmentIds,
          is_system_hidden: isSystemHidden,
          steps,
        })
        toast.success(t('pages.taChains.toasts.created'))
      }
      onSuccess()
    } catch (err) {
      toast.error(getErrorMessage(err))
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4">
      {isLocked && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <span className="font-semibold">⚠</span>
          <span>
            {t(
              'pages.taChains.form.structurallyLocked',
              'This chain has recorded interactions. Step layout and chain type are frozen — clone the chain to make structural changes. Name, description and department scope can still be edited.'
            )}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <Label htmlFor="chain-name">{t('pages.taChains.form.name')}</Label>
        <Input
          id="chain-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={150}
        />
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="chain-desc">{t('pages.taChains.form.description')}</Label>
        <Textarea
          id="chain-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label>{t('pages.taChains.form.chainType')}</Label>
          <Select
            value={chainType}
            onValueChange={(v) => setChainType(v as ChainType)}
            disabled={isLocked}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHAIN_TYPES.map((ct) => (
                <SelectItem key={ct} value={ct}>
                  {t(`pages.taChains.chainTypes.${ct}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label>{t('pages.taChains.form.department')}</Label>
          <DropdownMenu
            open={deptOpen}
            onOpenChange={(o) => {
              setDeptOpen(o)
              if (!o) setDeptSearch('')
            }}
            modal={false}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="focus:border-primary-500 flex min-h-[40px] w-full items-center justify-between gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-sm outline-none hover:bg-gray-50"
              >
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {departmentIds.length === 0 ? (
                    <span className="text-gray-400">
                      {t('pages.taChains.form.departmentPlaceholder')}
                    </span>
                  ) : (
                    departmentIds.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
                      >
                        {departmentNameById.get(id) ?? `#${id}`}
                        <button
                          type="button"
                          aria-label="remove"
                          onClick={(ev) => {
                            ev.stopPropagation()
                            toggleDepartment(id)
                          }}
                          className="rounded-full hover:bg-blue-100"
                        >
                          <Icons.Close size={12} strokeWidth={2} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <Icons.ArrowDown size={16} className="text-gray-400" strokeWidth={1.5} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="w-[--radix-dropdown-menu-trigger-width] min-w-[240px] rounded-md border border-gray-200 bg-white p-0 shadow-lg"
            >
              <div className="border-b border-gray-200 p-2">
                <input
                  type="text"
                  value={deptSearch}
                  onChange={(e) => setDeptSearch(e.target.value)}
                  placeholder={t('pages.taChains.form.departmentSearchPlaceholder')}
                  className="focus:border-primary-500 w-full rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                />
              </div>
              <div
                className="max-h-[220px] overflow-y-auto overscroll-contain p-1"
                onWheel={(e) => e.stopPropagation()}
              >
                {filteredDepartments.length === 0 ? (
                  <div className="py-3 text-center text-xs text-gray-500">
                    {t('pages.taChains.form.departmentNoneFound')}
                  </div>
                ) : (
                  filteredDepartments.map((d) => (
                    <label
                      key={d.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
                    >
                      <Checkbox
                        checked={departmentIds.includes(d.id)}
                        onCheckedChange={() => toggleDepartment(d.id)}
                      />
                      <span className="text-sm text-gray-800">{d.name}</span>
                    </label>
                  ))
                )}
              </div>
              {departmentIds.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-2 py-1.5">
                  <span className="text-xs text-gray-500">
                    {t('pages.taChains.form.departmentSelectedCount', {
                      count: departmentIds.length,
                    })}
                  </span>
                  <button
                    type="button"
                    onClick={clearDepartments}
                    className="text-xs text-gray-600 hover:text-gray-900"
                  >
                    {t('pages.taChains.form.departmentClear')}
                  </button>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isSystemHidden}
          onChange={(e) => setIsSystemHidden(e.target.checked)}
        />
        {t('pages.taChains.form.systemHidden')}
      </label>

      <ChainStepsEditor steps={steps} onChange={setSteps} disabled={isLocked} />
    </form>
  )
}
