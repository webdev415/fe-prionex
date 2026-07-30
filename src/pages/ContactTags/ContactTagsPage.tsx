/**
 * CRM Settings — Contact Tags directory (admin).
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getErrorMessage } from '@/lib/errors'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal, ModalContent, ModalFooter, ModalHeader } from '@/components/ui/Modal'
import { RadioGroup, RadioItem } from '@/components/ui/Radio'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'
import { ColorPickerField } from '@/components/forms'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useContactTagCategories,
  useCreateContactTagCategory,
  useCreateContactTagValue,
  usePatchContactTagCategory,
  usePatchContactTagValue,
} from '@/features/contactTags/hooks/useContactTags'
import type { ContactTagCategory, ContactTagValue } from '@/features/contactTags/types'

type StatusFilter = 'all' | 'active' | 'hidden'

export function ContactTagsPage() {
  const { t } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const {
    data: categories = [],
    isPending,
    isError,
    refetch,
  } = useContactTagCategories(statusFilter)
  const createCategory = useCreateContactTagCategory()
  const patchCategory = usePatchContactTagCategory()
  const createValue = useCreateContactTagValue()
  const patchValue = usePatchContactTagValue()

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [valueModalOpen, setValueModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<ContactTagCategory | null>(null)
  const [editingValue, setEditingValue] = useState<{
    category: ContactTagCategory
    value: ContactTagValue | null
  } | null>(null)

  const [catName, setCatName] = useState('')
  const [catSortOrder, setCatSortOrder] = useState('100')
  const [catSelectionType, setCatSelectionType] = useState<'single' | 'multi'>('single')
  const [catProtected, setCatProtected] = useState(false)
  const [valName, setValName] = useState('')
  const [valColor, setValColor] = useState('#6366f1')
  const [valSortOrder, setValSortOrder] = useState('100')
  const [valBlocksCalls, setValBlocksCalls] = useState(false)
  const [valBlocksSms, setValBlocksSms] = useState(false)
  const [valBlocksSpam, setValBlocksSpam] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const openCreateCategory = () => {
    setFormError(null)
    setEditingCategory(null)
    setCatName('')
    setCatSortOrder('100')
    setCatSelectionType('single')
    setCatProtected(false)
    setCategoryModalOpen(true)
  }

  const openEditCategory = (row: ContactTagCategory) => {
    setEditingCategory(row)
    setCatName(row.name)
    setCatSortOrder(String(row.sort_order))
    setCatSelectionType(row.selection_type)
    setCatProtected(row.is_protected)
    setCategoryModalOpen(true)
  }

  const openCreateValue = (category: ContactTagCategory) => {
    setFormError(null)
    setEditingValue({ category, value: null })
    setValName('')
    setValColor('#6366f1')
    setValSortOrder('100')
    setValBlocksCalls(false)
    setValBlocksSms(false)
    setValBlocksSpam(false)
    setValueModalOpen(true)
  }

  const openEditValue = (category: ContactTagCategory, value: ContactTagValue) => {
    setEditingValue({ category, value })
    setValName(value.name)
    setValColor(value.color || '#6366f1')
    setValSortOrder(String(value.sort_order))
    setValBlocksCalls(value.blocks_calls)
    setValBlocksSms(value.blocks_sms)
    setValBlocksSpam(value.blocks_spam)
    setValueModalOpen(true)
  }

  const saveCategory = () => {
    const sort = Number(catSortOrder)
    if (!catName.trim() || Number.isNaN(sort)) return
    setFormError(null)
    const onError = (error: unknown) => {
      const message = getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
    if (editingCategory) {
      patchCategory.mutate(
        {
          categoryId: editingCategory.id,
          payload: {
            name: catName.trim(),
            sort_order: sort,
            selection_type: editingCategory.is_system ? undefined : catSelectionType,
            is_protected: editingCategory.is_system ? undefined : catProtected,
          },
        },
        {
          onSuccess: () => {
            setCategoryModalOpen(false)
            refetch()
          },
          onError,
        }
      )
    } else {
      createCategory.mutate(
        {
          name: catName.trim(),
          sort_order: sort,
          selection_type: catSelectionType,
          is_protected: catProtected,
          protected_role_ids: [],
        },
        {
          onSuccess: () => {
            setCategoryModalOpen(false)
            refetch()
          },
          onError,
        }
      )
    }
  }

  const saveValue = () => {
    if (!editingValue) return
    const sort = Number(valSortOrder)
    if (!valName.trim() || Number.isNaN(sort)) return
    setFormError(null)
    const onError = (error: unknown) => {
      const message = getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
    if (editingValue.value) {
      patchValue.mutate(
        {
          valueId: editingValue.value.id,
          payload: {
            name: valName.trim(),
            color: valColor,
            blocks_calls: valBlocksCalls,
            blocks_sms: valBlocksSms,
            blocks_spam: valBlocksSpam,
            sort_order: sort,
          },
        },
        {
          onSuccess: () => {
            setValueModalOpen(false)
            refetch()
          },
          onError,
        }
      )
    } else {
      createValue.mutate(
        {
          categoryId: editingValue.category.id,
          payload: {
            name: valName.trim(),
            color: valColor,
            blocks_calls: valBlocksCalls,
            blocks_sms: valBlocksSms,
            blocks_spam: valBlocksSpam,
            sort_order: sort,
          },
        },
        {
          onSuccess: () => {
            setValueModalOpen(false)
            refetch()
          },
          onError,
        }
      )
    }
  }

  // Column defs reference handlers — do not wrap in useMemo without listing those
  // deps (react-hooks/preserve-manual-memoization). Small table: rebuild each render.
  const columns: Column<ContactTagCategory>[] = [
    { key: 'sort_order', header: t('pages.contactTags.tableHeaders.sortOrder', 'Sort') },
    { key: 'name', header: t('pages.contactTags.category', 'Category') },
    {
      key: 'selection_type',
      header: t('pages.contactTags.tableHeaders.selectionType', 'Selection'),
      render: (row) =>
        row.selection_type === 'multi'
          ? t('pages.contactTags.multi', 'Multi')
          : t('pages.contactTags.single', 'Single'),
    },
    {
      key: 'is_protected',
      header: t('pages.contactTags.protected', 'Protected'),
      render: (row) => (row.is_protected ? t('common.yes', 'Yes') : t('common.no', 'No')),
    },
    {
      key: 'is_system',
      header: t('pages.contactTags.system', 'System'),
      render: (row) => (row.is_system ? t('common.yes', 'Yes') : t('common.no', 'No')),
    },
    {
      key: 'values',
      header: t('pages.contactTags.values', 'Values'),
      render: (row) =>
        row.values
          .filter((v) => !v.is_hidden)
          .map((v) => v.name)
          .join(', ') || '—',
    },
    {
      key: 'status',
      header: t('pages.contactTags.status', 'Status'),
      render: (row) =>
        row.is_hidden
          ? t('pages.contactTags.hidden', 'Hidden')
          : t('pages.contactTags.active', 'Active'),
    },
    {
      key: 'actions',
      header: '',
      render: (row) => (
        <div className="flex gap-2">
          <PermissionGuard permission={PERMISSIONS.CONTACT_TAGS.MANAGE}>
            <Button size="sm" variant="ghost" onClick={() => openEditCategory(row)}>
              {t('common.edit', 'Edit')}
            </Button>
            {!row.is_system && (
              <Button size="sm" variant="ghost" onClick={() => openCreateValue(row)}>
                {t('pages.contactTags.addValue', 'Add value')}
              </Button>
            )}
          </PermissionGuard>
        </div>
      ),
    },
  ]

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('pages.contactTags.title', 'Contact Tags')}</h1>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('pages.contactTags.all', 'All')}</SelectItem>
              <SelectItem value="active">{t('pages.contactTags.active', 'Active')}</SelectItem>
              <SelectItem value="hidden">{t('pages.contactTags.hidden', 'Hidden')}</SelectItem>
            </SelectContent>
          </Select>
          <PermissionGuard permission={PERMISSIONS.CONTACT_TAGS.MANAGE}>
            <Button onClick={openCreateCategory}>
              {t('pages.contactTags.createCategory', 'New category')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {isError ? (
        <p className="text-red-500">{t('common.loadError', 'Failed to load data')}</p>
      ) : isPending ? (
        <p className="text-dark-500 text-sm">{t('status.loading')}</p>
      ) : (
        <DataTable columns={columns} data={categories} />
      )}

      {categories.map((cat) =>
        cat.values.length > 0 ? (
          <div key={`values-${cat.id}`} className="rounded border p-3">
            <div className="mb-2 text-sm font-medium">{cat.name} — values</div>
            <div className="flex flex-wrap gap-2">
              {cat.values.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="rounded-full px-2 py-0.5 text-xs text-white"
                  style={{ backgroundColor: v.color || '#64748b', opacity: v.is_hidden ? 0.5 : 1 }}
                  onClick={() => openEditValue(cat, v)}
                >
                  {v.name}
                  {v.blocks_calls ? ' 📵' : ''}
                </button>
              ))}
            </div>
          </div>
        ) : null
      )}

      <Modal open={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} maxWidth="lg">
        <ModalHeader
          title={
            editingCategory
              ? t('pages.contactTags.editCategory', 'Edit category')
              : t('pages.contactTags.createCategory', 'New category')
          }
        />
        <ModalContent className="flex flex-col gap-4">
          <Input
            label={t('pages.contactTags.fieldName', 'Name')}
            value={catName}
            onChange={(e) => setCatName(e.target.value)}
            required
          />
          <Input
            label={t('pages.contactTags.sortOrder', 'Sort order')}
            value={catSortOrder}
            onChange={(e) => setCatSortOrder(e.target.value)}
            type="number"
          />
          {!editingCategory?.is_system && (
            <>
              <div>
                <p className="text-dark-500 mb-2 text-sm">
                  {t('pages.contactTags.selectionType', 'Selection type')}
                </p>
                <RadioGroup
                  value={catSelectionType}
                  onValueChange={(v) => setCatSelectionType(v as 'single' | 'multi')}
                  className="flex flex-col gap-2 sm:flex-row"
                >
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioItem value="single" id="ct-single" />
                    <span>{t('pages.contactTags.single', 'Single')}</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <RadioItem value="multi" id="ct-multi" />
                    <span>{t('pages.contactTags.multi', 'Multi')}</span>
                  </label>
                </RadioGroup>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-dark-500 text-sm">
                  {t('pages.contactTags.protected', 'Protected')}
                </span>
                <ToggleSwitch checked={catProtected} onChange={setCatProtected} />
              </div>
            </>
          )}
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setCategoryModalOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={saveCategory}>{t('common.save', 'Save')}</Button>
        </ModalFooter>
      </Modal>

      <Modal open={valueModalOpen} onClose={() => setValueModalOpen(false)} maxWidth="lg">
        <ModalHeader
          title={
            editingValue?.value
              ? t('pages.contactTags.editValue', 'Edit value')
              : t('pages.contactTags.addValue', 'Add value')
          }
        />
        <ModalContent className="flex flex-col gap-4">
          <Input
            label={t('pages.contactTags.fieldName', 'Name')}
            value={valName}
            onChange={(e) => setValName(e.target.value)}
            required
          />
          <ColorPickerField
            value={valColor}
            onChange={setValColor}
            label={t('pages.contactTags.fieldColor', 'Color')}
            showPreview
            previewText={valName.trim() || t('pages.contactTags.valuePreview', 'Tag value')}
          />
          <Input
            label={t('pages.contactTags.sortOrder', 'Sort order')}
            value={valSortOrder}
            onChange={(e) => setValSortOrder(e.target.value)}
            type="number"
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-dark-500 text-sm">
              {t('pages.contactTags.blocksCalls', 'Blocks calls')}
            </span>
            <ToggleSwitch checked={valBlocksCalls} onChange={setValBlocksCalls} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-dark-500 text-sm">
              {t('pages.contactTags.blocksSms', 'Blocks SMS')}
            </span>
            <ToggleSwitch checked={valBlocksSms} onChange={setValBlocksSms} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-dark-500 text-sm">
              {t('pages.contactTags.blocksSpam', 'Blocks spam')}
            </span>
            <ToggleSwitch checked={valBlocksSpam} onChange={setValBlocksSpam} />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
        </ModalContent>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setValueModalOpen(false)}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button onClick={saveValue}>{t('common.save', 'Save')}</Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}

export default ContactTagsPage
