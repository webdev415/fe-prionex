import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/Input'
import { useUpdatePersonal } from '@/features/employeeCard/hooks/useEmployeeCard'
import type { EmployeeCard } from '@/features/employeeCard/types.card'
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
 * It carries more than the design's popup shows. The section displays the
 * address, Telegram and delivery branch, and a dialog that edited only half of
 * them would leave the rest with no way to be changed at all.
 *
 * A field left blank is sent as null rather than omitted, so clearing one
 * works. Only fields the form actually holds are sent, so nothing outside it
 * is touched.
 */
export function PersonalDialog({ card, projectId, open, onClose }: PersonalDialogProps) {
  const { t } = useTranslation()
  const mutation = useUpdatePersonal(card.header.id, projectId)
  const { save, error, saving } = useSectionSave(mutation, onClose)

  const [values, setValues] = useState({
    date_of_birth: card.personal.date_of_birth ?? '',
    gender: card.personal.gender ?? '',
    citizenship: card.personal.citizenship ?? '',
    tax_id: card.personal.tax_id ?? '',
    passport: card.personal.passport ?? '',
    telegram: card.personal.telegram ?? '',
    city: card.personal.city ?? '',
    address: card.personal.address ?? '',
    nova_poshta_branch: card.personal.nova_poshta_branch ?? '',
    referral_source: card.personal.referral_source ?? '',
  })

  const field = (name: keyof typeof values, label: string, type = 'text') => (
    <Input
      label={label}
      type={type}
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
          void save(
            Object.fromEntries(
              Object.entries(values).map(([name, value]) => [name, value.trim() || null])
            )
          )
        }}
      >
        {field('date_of_birth', t('pages.employeeCard.fields.dateOfBirth'), 'date')}
        {field('gender', t('pages.employeeCard.fields.gender'))}
        {field('citizenship', t('pages.employeeCard.fields.citizenship'))}
        {field('tax_id', t('pages.employeeCard.fields.taxId'))}
        {field('passport', t('pages.employeeCard.fields.passport'))}
        {field('telegram', t('pages.employeeCard.fields.telegram'))}
        {field('city', t('pages.employeeCard.fields.city'))}
        {field('address', t('pages.employeeCard.fields.address'))}
        {field('nova_poshta_branch', t('pages.employeeCard.fields.novaPoshta'))}
        {field('referral_source', t('pages.employeeCard.fields.referralSource'))}
      </form>
    </SectionDialog>
  )
}
