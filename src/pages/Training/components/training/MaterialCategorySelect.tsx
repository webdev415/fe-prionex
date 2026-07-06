import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Icons } from '@/lib/icons'
import {
  useCreateMaterialCategory,
  useMaterialCategories,
} from '@/features/training/hooks/useMaterials'

/**
 * Category picker for the material dialogs (KAN-499). Lists the project's
 * categories and lets a trainer create one inline (there is no separate
 * taxonomy screen), selecting the new category on success.
 */
export interface MaterialCategorySelectProps {
  id?: string
  value: number | ''
  onChange: (value: number | '') => void
  /** Gate the categories fetch to when the parent dialog is open. */
  enabled?: boolean
}

export function MaterialCategorySelect({
  id,
  value,
  onChange,
  enabled = true,
}: MaterialCategorySelectProps) {
  const { t } = useTranslation('common')
  const { data: categories } = useMaterialCategories(enabled)
  const create = useCreateMaterialCategory()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  const handleCreate = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    try {
      const category = await create.mutateAsync(trimmed)
      onChange(category.id)
      setName('')
      setAdding(false)
    } catch {
      toast.error(
        t(
          'pages.training.training.materials.errors.createCategory',
          'Could not create the category.'
        )
      )
    }
  }

  if (adding) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder={t(
            'pages.training.training.materials.newCategoryPlaceholder',
            'New category name'
          )}
          className="h-[40px] flex-1 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleCreate()
            }
          }}
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleCreate}
          disabled={create.isPending || !name.trim()}
          className="rounded-full"
        >
          {t('actions.add', 'Add')}
        </Button>
        <Button
          variant="cancel"
          size="md"
          onClick={() => {
            setAdding(false)
            setName('')
          }}
          disabled={create.isPending}
          className="rounded-full"
        >
          {t('actions.cancel', 'Cancel')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none"
      >
        <option value="">{t('pages.training.training.materials.noCategory', 'No category')}</option>
        {(categories ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-2 text-xs whitespace-nowrap text-gray-600 hover:border-gray-400"
      >
        <Icons.Add size={14} />
        {t('pages.training.training.materials.newCategory', 'New')}
      </button>
    </div>
  )
}

export default MaterialCategorySelect
