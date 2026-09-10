import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EmployeeCard } from '@/features/employeeCard/types.card'

interface Mutation<TChanges> {
  mutateAsync: (changes: TChanges) => Promise<EmployeeCard>
  isPending: boolean
}

/**
 * Saving one section, and keeping the dialog open when it fails.
 *
 * The message the server sends is preferred over a generic one, because the
 * refusals worth reading are specific: a position that belongs to another
 * department, or identity documents that cannot be stored until keys exist.
 */
export function useSectionSave<TChanges>(mutation: Mutation<TChanges>, onSaved: () => void) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)

  const save = async (changes: TChanges) => {
    setError(null)
    try {
      await mutation.mutateAsync(changes)
      onSaved()
    } catch (caught) {
      const detail = (caught as { response?: { data?: { detail?: unknown } } })?.response?.data
        ?.detail
      setError(typeof detail === 'string' ? detail : t('pages.employeeCard.saveFailed'))
    }
  }

  return { save, error, saving: mutation.isPending }
}
