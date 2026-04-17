/**
 * TA Chain create/edit form (KAN-318).
 */

import { useState } from 'react'
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
  const departments = departmentsData?.departments ?? []

  const createMut = useCreateTAChain()
  const updateMut = useUpdateTAChain()

  const isEdit = !!initial

  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [chainType, setChainType] = useState<ChainType>(initial?.chain_type ?? 'manual')
  const [departmentId, setDepartmentId] = useState<string>(
    initial?.department_id ? String(initial.department_id) : ''
  )
  const [isSystemHidden, setIsSystemHidden] = useState<boolean>(initial?.is_system_hidden ?? false)
  const [steps, setSteps] = useState<TAChainStepIn[]>(
    initial?.steps?.map((s) => ({
      target_action_id: s.target_action_id,
      is_required: s.is_required,
      delay_minutes: s.delay_minutes,
      not_in_the_past: s.not_in_the_past,
    })) ?? []
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error(t('pages.taChains.errors.nameRequired'))
      return
    }
    const deptId = parseInt(departmentId, 10)
    if (!deptId || Number.isNaN(deptId)) {
      toast.error(t('pages.taChains.errors.departmentRequired'))
      return
    }

    try {
      if (isEdit && initial) {
        await updateMut.mutateAsync({
          id: initial.id,
          payload: {
            name: name.trim(),
            description: description || undefined,
            chain_type: chainType,
            department_id: deptId,
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
          department_id: deptId,
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
          <Select value={chainType} onValueChange={(v) => setChainType(v as ChainType)}>
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
          <Select value={departmentId} onValueChange={(v) => setDepartmentId(v)}>
            <SelectTrigger>
              <SelectValue placeholder={t('pages.taChains.form.departmentPlaceholder')} />
            </SelectTrigger>
            <SelectContent>
              {departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <ChainStepsEditor
        departmentId={departmentId ? parseInt(departmentId, 10) : null}
        steps={steps}
        onChange={setSteps}
      />
    </form>
  )
}
