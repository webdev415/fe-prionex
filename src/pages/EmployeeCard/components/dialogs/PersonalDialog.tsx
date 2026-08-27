import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { useUpdatePersonal } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard, PersonalInformationUpdate } from '@/features/employeeCard/types.card'
import { SectionDialog } from './SectionDialog'
import { useSectionSave } from './useSectionSave'

export interface PersonalDialogProps {
  card: EmployeeCard
  projectId: number | null
  open: boolean
  onClose: () => void
}

const FORM_ID = 'employee-card-personal'

/**
 * The Personal Data dialog.
 *
 * It carries more than the design's popup shows, because the popup and the
 * section it belongs to were drawn from different lists. The section displays
 * name, phone and email alongside the address and Telegram, and a dialog that
 * edited only some of them would leave the rest with no way to be changed at
 * all - which is exactly what happened once the employees list dropped its
 * Actions column and took the user edit modal with it.
 *
 * A field left blank is sent as null rather than omitted, so clearing one
 * works. Name, email and work format are the exception: those columns cannot
 * be empty, so the form requires them rather than sending a null the server
 * would have to refuse.
 */
export function PersonalDialog({ card, projectId, open, onClose }: PersonalDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdatePersonal(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const [values, setValues] = useState({
    last_name: card.header.last_name ?? '',
    first_name: card.header.first_name ?? '',
    middle_name: card.header.middle_name ?? '',
    date_of_birth: card.personal.date_of_birth ?? '',
    phone: card.header.phone ?? '',
    telegram: card.personal.telegram ?? '',
    email: card.header.email ?? '',
    city: card.personal.city ?? '',
    address: card.personal.address ?? '',
    nova_poshta_branch: card.personal.nova_poshta_branch ?? '',
    referral_source: card.personal.referral_source ?? '',
  })
  const [workFormat, setWorkFormat] = useState(card.header.work_format ?? 'office')

  const REQUIRED = ['last_name', 'first_name', 'email']

  const field = (name: keyof typeof values, label: string, type = 'text') => (
    <Input
      label={label}
      type={type}
      required={REQUIRED.includes(name)}
      value={values[name]}
      onChange={(event) => setValues({ ...values, [name]: event.target.value })}
    />
  )

  return (
    <SectionDialog
      open={open}
      title={t('pages.employeeCard.dialogs.personal')}
      formId={FORM_ID}
      saving={saving}
      error={error}
      onClose={onClose}
    >
      <form
        id={FORM_ID}
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          const changes = Object.fromEntries(
            Object.entries(values).map(([name, value]) => [name, value.trim() || null])
          ) as PersonalInformationUpdate
          void save({ ...changes, work_format: workFormat })
        }}
      >
        {field('last_name', t('pages.employeeCard.fields.lastName'))}
        {field('first_name', t('pages.employeeCard.fields.firstName'))}
        {field('middle_name', t('pages.employeeCard.fields.middleName'))}
        {field('date_of_birth', t('pages.employeeCard.fields.dateOfBirth'), 'date')}
        {field('phone', t('pages.employeeCard.fields.phone'), 'tel')}
        {field('telegram', t('pages.employeeCard.fields.telegram'))}
        {field('email', t('pages.employeeCard.fields.email'), 'email')}
        {field('city', t('pages.employeeCard.fields.city'))}
        {field('address', t('pages.employeeCard.fields.address'))}
        {field('nova_poshta_branch', t('pages.employeeCard.fields.novaPoshta'))}

        <div className="space-y-1.5">
          <span className="text-muted-foreground text-xs">
            {t('pages.employeeCard.fields.workFormat')}
          </span>
          <Select value={workFormat} onValueChange={setWorkFormat}>
            <SelectTrigger aria-label={t('pages.employeeCard.fields.workFormat')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="office">{t('pages.employeeCard.workFormat.office')}</SelectItem>
              <SelectItem value="remote">{t('pages.employeeCard.workFormat.remote')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {field('referral_source', t('pages.employeeCard.fields.referralSource'))}
      </form>
    </SectionDialog>
  )
}
