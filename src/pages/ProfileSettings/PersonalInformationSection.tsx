import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { Button } from '@/components/ui/Button'
import { DoubleButton } from '@/components/ui/DoubleButton'
import { Input } from '@/components/ui/Input'
import {
  useMyPersonalInformation,
  useUpdateMyPersonalInformation,
} from '@/features/auth/hooks/useMyPersonalInformation'
import type { MyPersonalInformation, MyPersonalInformationInput } from '@/types/api'

const FIELDS = [
  { name: 'date_of_birth', label: 'dateOfBirth', type: 'date' },
  { name: 'telegram', label: 'telegram', type: 'text' },
  { name: 'city', label: 'city', type: 'text' },
  { name: 'address', label: 'address', type: 'text' },
  { name: 'nova_poshta_branch', label: 'novaPoshta', type: 'text' },
] as const

type Values = Record<(typeof FIELDS)[number]['name'], string>

const EMPTY: Values = {
  date_of_birth: '',
  telegram: '',
  city: '',
  address: '',
  nova_poshta_branch: '',
}

function toForm(saved: MyPersonalInformation | undefined): Values {
  if (!saved) return EMPTY
  return Object.fromEntries(FIELDS.map(({ name }) => [name, saved[name] ?? ''])) as Values
}

/**
 * The part of the employee card somebody keeps about themselves.
 *
 * It is a separate form from the profile above rather than more rows in it,
 * because it saves to a different endpoint. Sharing one Save button would
 * mean either firing two writes that can half-fail, or making the profile
 * wait on a request it has nothing to do with.
 *
 * The rest of the card is not here on purpose. Military service, visa status
 * and how somebody came to be hired are records held about a person, not by
 * them, and HR owns them.
 */
export function PersonalInformationSection() {
  const { t } = useTranslation()
  const { data, isLoading } = useMyPersonalInformation()
  const mutation = useUpdateMyPersonalInformation()

  const [values, setValues] = useState<Values>(EMPTY)

  /*
   * The form starts empty and is filled once the answer arrives. Keying off
   * `data` rather than a mount effect means a save's answer also resettles
   * the form, so what is on screen is always what was actually stored.
   */
  useEffect(() => {
    setValues(toForm(data))
  }, [data])

  const saved = toForm(data)
  const changed = FIELDS.some(({ name }) => values[name].trim() !== saved[name])

  if (isLoading) {
    return (
      <div className="border-border flex w-full flex-col gap-4 self-stretch border-t pt-6">
        <span className="text-foreground self-stretch text-base font-medium tracking-[-0.36px] sm:text-[18px]">
          {t('pages.profile.personalInformation.title')}
        </span>
        <span className="text-muted-foreground text-sm">{t('common.loading')}</span>
      </div>
    )
  }

  return (
    <form
      className="border-border flex w-full flex-col items-center gap-4 self-stretch border-t pt-6 sm:gap-6"
      onSubmit={(event) => {
        event.preventDefault()
        mutation.mutate(
          FIELDS.reduce<MyPersonalInformationInput>((payload, { name }) => {
            payload[name] = values[name].trim() || null
            return payload
          }, {})
        )
      }}
    >
      <div className="flex w-full flex-col items-start gap-1 self-stretch">
        <span className="text-foreground self-stretch text-base leading-[150%] font-medium tracking-[-0.36px] sm:text-[18px]">
          {t('pages.profile.personalInformation.title')}
        </span>
        <span className="text-muted-foreground self-stretch text-sm">
          {t('pages.profile.personalInformation.description')}
        </span>
      </div>

      <div className="grid w-full gap-4 self-stretch sm:grid-cols-2">
        {FIELDS.map(({ name, label, type }) => (
          <Input
            key={name}
            label={t(`pages.employeeCard.fields.${label}`)}
            type={type}
            value={values[name]}
            onChange={(event) => setValues({ ...values, [name]: event.target.value })}
            className="w-full"
          />
        ))}
      </div>

      {changed && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
          <Button
            type="button"
            variant="cancel"
            onClick={() => setValues(toForm(data))}
            className="h-12 w-48 rounded-full px-10"
          >
            {t('actions.cancel')}
          </Button>
          <DoubleButton
            type="submit"
            icon={<Icons.Tick02 size={28} />}
            iconPosition="left"
            disabled={mutation.isPending}
            className="h-12 w-48"
            onClick={() => {}}
          >
            {t('pages.profile.saveChanges')}
          </DoubleButton>
        </div>
      )}
    </form>
  )
}

export default PersonalInformationSection
