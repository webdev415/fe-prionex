/**
 * CRM Settings — Contact Types directory (admin).
 */

import { useMemo, useState } from 'react'
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
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import {
  useContactTypes,
  useCreateContactType,
  usePatchContactType,
} from '@/features/clients/hooks/useClients'
import type { ContactSource, ContactTypeOption } from '@/features/clients/api/types'

type StatusFilter = 'all' | 'active' | 'hidden'

export function ContactTypesPage() {
  const { t, i18n } = useTranslation('common')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const { data: rows = [], isPending, isError, refetch } = useContactTypes(statusFilter)
  const createMutation = useCreateContactType()
  const patchMutation = usePatchContactType()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ContactTypeOption | null>(null)
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState('10')
  const [defaultLine, setDefaultLine] = useState<'white' | 'gray'>('white')
  const [spamAllowed, setSpamAllowed] = useState(false)
  const [primaryPhone, setPrimaryPhone] = useState(false)
  const [contactSource, setContactSource] = useState<ContactSource>('client')
  const [formError, setFormError] = useState<string | null>(null)

  const contactSourceLabel = (source: ContactSource) =>
    source === 'recommender'
      ? t('pages.contactTypes.recommender', 'Recommender')
      : t('pages.contactTypes.client', 'Client')

  const openCreate = () => {
    setFormError(null)
    setEditing(null)
    setName('')
    setSortOrder('100')
    setDefaultLine('white')
    setSpamAllowed(false)
    setPrimaryPhone(false)
    setContactSource('client')
    setFormOpen(true)
  }

  const openEdit = (row: ContactTypeOption) => {
    setEditing(row)
    setName(row.name)
    setSortOrder(String(row.sort_order))
    setDefaultLine(row.default_call_line === 'gray' ? 'gray' : 'white')
    setSpamAllowed(row.spam_allowed)
    setPrimaryPhone(row.show_as_primary_phone)
    setContactSource(row.contact_source ?? 'client')
    setFormOpen(true)
  }

  const handleSave = () => {
    const so = Number(sortOrder)
    if (!name.trim() || Number.isNaN(so)) return
    setFormError(null)
    const onError = (error: unknown) => {
      const message = getErrorMessage(error)
      setFormError(message)
      toast.error(message)
    }
    if (editing) {
      patchMutation.mutate(
        {
          typeId: editing.id,
          payload: {
            name: name.trim(),
            sort_order: so,
            default_call_line: defaultLine,
            spam_allowed: spamAllowed,
            show_as_primary_phone: primaryPhone,
            contact_source: contactSource,
          },
        },
        {
          onSuccess: () => {
            setFormOpen(false)
            refetch()
          },
          onError,
        }
      )
    } else {
      createMutation.mutate(
        {
          name: name.trim(),
          sort_order: so,
          default_call_line: defaultLine,
          spam_allowed: spamAllowed,
          show_as_primary_phone: primaryPhone,
          contact_source: contactSource,
        },
        {
          onSuccess: () => {
            setFormOpen(false)
            refetch()
          },
          onError,
        }
      )
    }
  }

  const toggleHidden = (row: ContactTypeOption) => {
    patchMutation.mutate(
      { typeId: row.id, payload: { is_hidden: !row.is_hidden } },
      { onSuccess: () => refetch() }
    )
  }

  const toggleShowInClientDetail = (row: ContactTypeOption) => {
    patchMutation.mutate(
      { typeId: row.id, payload: { show_in_client_detail: !row.show_in_client_detail } },
      {
        onSuccess: () => {
          refetch()
          toast.success(
            row.show_in_client_detail
              ? t('pages.contactTypes.toasts.hiddenFromClientDetail', 'Hidden from client detail')
              : t('pages.contactTypes.toasts.shownOnClientDetail', 'Shown on client detail')
          )
        },
        onError: (error) => toast.error(getErrorMessage(error)),
      }
    )
  }

  const filteredRows = useMemo(() => rows, [rows])

  // Column defs reference handlers — do not wrap in useMemo without listing those
  // deps (react-hooks/preserve-manual-memoization). Small table: rebuild each render.
  const columns: Column<ContactTypeOption>[] = [
    {
      key: 'sort_order',
      header: t('pages.contactTypes.columns.sortOrder', 'Sort Order'),
      render: (r) => <span>{r.sort_order}</span>,
    },
    {
      key: 'name',
      header: t('pages.contactTypes.columns.name', 'Name'),
      render: (r) => (
        <span className={r.is_hidden ? 'text-gray-400' : ''}>
          {i18n.language === 'uk' ? r.name : t(`contactTypes.${r.code}`, { defaultValue: r.name })}
        </span>
      ),
    },
    {
      key: 'default_call_line',
      header: t('pages.contactTypes.columns.defaultLine', 'Default Call Line'),
      render: (r) => (
        <span>
          {r.default_call_line === 'gray'
            ? t('pages.contactTypes.gray', 'Gray')
            : t('pages.contactTypes.white', 'White')}
        </span>
      ),
    },
    {
      key: 'contact_source',
      header: t('pages.contactTypes.columns.contactSource', 'Contact Source'),
      render: (r) => <span>{contactSourceLabel(r.contact_source ?? 'client')}</span>,
    },
    {
      key: 'spam_allowed',
      header: t('pages.contactTypes.columns.spamAllowed', 'Spam Allowed'),
      render: (r) => (r.spam_allowed ? t('common.yes') : t('common.no')),
    },
    {
      key: 'show_as_primary_phone',
      header: t('pages.contactTypes.columns.primary', 'Show as Primary Phone'),
      render: (r) => (r.show_as_primary_phone ? t('common.yes') : t('common.no')),
    },
    {
      key: 'show_in_client_detail',
      header: t('pages.contactTypes.columns.showInClientDetail', 'Show in Client Detail'),
      render: (r) => (r.show_in_client_detail ? t('common.yes') : t('common.no')),
    },
    {
      key: 'is_hidden',
      header: t('pages.contactTypes.columns.status', 'Status'),
      render: (r) =>
        r.is_hidden
          ? t('pages.contactTypes.hidden', 'Hidden')
          : t('pages.contactTypes.active', 'Active'),
    },
    {
      key: 'actions',
      header: t('pages.contactTypes.columns.actions', 'Actions'),
      render: (r) => (
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGuard
            permissions={[PERMISSIONS.CONTACT_TYPES.VIEW, PERMISSIONS.CONTACT_TYPES.EDIT]}
            mode="all"
          >
            <Button size="sm" variant="outline" onClick={() => openEdit(r)}>
              {t('actions.edit', 'Edit')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggleHidden(r)}>
              {r.is_hidden
                ? t('pages.contactTypes.restore', 'Restore')
                : t('pages.contactTypes.hide', 'Hide')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => toggleShowInClientDetail(r)}>
              {r.show_in_client_detail
                ? t('pages.contactTypes.hideFromClientDetail', 'Hide from client')
                : t('pages.contactTypes.showOnClientDetail', 'Show on client')}
            </Button>
          </PermissionGuard>
        </div>
      ),
    },
  ]

  if (isError) {
    return (
      <div className="p-6">
        <p className="text-error-500">{t('pages.contactTypes.errorLoading', 'Failed to load')}</p>
        <Button className="mt-2" onClick={() => refetch()}>
          {t('pages.contactTypes.retry', 'Retry')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h1 className="text-secondary-800 text-xl font-semibold md:text-2xl">
          {t('pages.contactTypes.title', 'Contact Types')}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-dark-500 text-sm">
            {t('pages.contactTypes.filterStatus', 'Status')}
            <select
              className="border-dark-300 ml-2 rounded-md border px-2 py-1 text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">{t('pages.contactTypes.filterAll', 'All')}</option>
              <option value="active">{t('pages.contactTypes.filterActive', 'Active')}</option>
              <option value="hidden">{t('pages.contactTypes.filterHidden', 'Hidden')}</option>
            </select>
          </label>
          <PermissionGuard
            permissions={[PERMISSIONS.CONTACT_TYPES.VIEW, PERMISSIONS.CONTACT_TYPES.CREATE]}
            mode="all"
          >
            <Button onClick={openCreate}>
              {t('pages.contactTypes.add', '+ Add contact type')}
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {isPending ? (
        <p className="text-dark-500 text-sm">{t('status.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={filteredRows}
          rowClassName={(r) => (r.is_hidden ? 'opacity-55' : undefined)}
        />
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} maxWidth="lg">
        <ModalHeader
          title={
            editing
              ? t('pages.contactTypes.editTitle', 'Edit contact type')
              : t('pages.contactTypes.createTitle', 'New contact type')
          }
        />
        <ModalContent className="flex flex-col gap-4">
          {formError && <p className="text-error-500 text-sm">{formError}</p>}
          <Input
            label={t('pages.contactTypes.fieldName', 'Name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <div>
            <p className="text-dark-500 mb-2 text-sm">
              {t('pages.contactTypes.fieldDefaultLine', 'Default Call Line')}
            </p>
            <RadioGroup
              value={defaultLine}
              onValueChange={(v) => setDefaultLine(v as 'white' | 'gray')}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <label className="flex items-center gap-2">
                <RadioItem value="white" id="ct-white" />
                <span>{t('pages.contactTypes.white', 'White')}</span>
              </label>
              <label className="flex items-center gap-2">
                <RadioItem value="gray" id="ct-gray" />
                <span>{t('pages.contactTypes.gray', 'Gray')}</span>
              </label>
            </RadioGroup>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-dark-500 text-sm">
              {t('pages.contactTypes.fieldSpam', 'Spam Allowed')}
            </span>
            <ToggleSwitch checked={spamAllowed} onChange={setSpamAllowed} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-dark-500 text-sm">
              {t('pages.contactTypes.fieldPrimary', 'Show as Primary Phone')}
            </span>
            <ToggleSwitch checked={primaryPhone} onChange={setPrimaryPhone} />
          </div>
          <div>
            <p className="text-dark-500 mb-2 text-sm">
              {t('pages.contactTypes.fieldContactSource', 'Contact Source')}
            </p>
            <p className="text-dark-400 mb-2 text-xs">
              {t(
                'pages.contactTypes.fieldContactSourceHint',
                'Categories the contact type. Used for visual indicators in search and for contact filtering in Target Action chain conditions.'
              )}
            </p>
            <Select
              value={contactSource}
              onValueChange={(v) => setContactSource(v as ContactSource)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="client">{contactSourceLabel('client')}</SelectItem>
                <SelectItem value="recommender">{contactSourceLabel('recommender')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            label={t('pages.contactTypes.fieldSort', 'Sort Order')}
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            type="number"
          />
        </ModalContent>
        <ModalFooter>
          <Button variant="cancel" onClick={() => setFormOpen(false)}>
            {t('actions.cancel')}
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              !name.trim() ||
              Number.isNaN(Number(sortOrder)) ||
              createMutation.isPending ||
              patchMutation.isPending
            }
          >
            {t('actions.save', 'Save')}
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  )
}
