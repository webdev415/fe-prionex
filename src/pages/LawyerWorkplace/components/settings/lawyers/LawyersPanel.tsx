import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { LetterTypeConfig } from '../../../settings/types'
import type { SettingsLawyer } from '../../../settings/types'
import { AddLawyerModal } from './AddLawyerModal'
import { AutoAssignmentCard } from './AutoAssignmentCard'
import { LawyersTable } from './LawyersTable'

interface LawyersPanelProps {
  lawyers: SettingsLawyer[]
  letterTypes: LetterTypeConfig[]
  availableUsers: { id: number; name: string }[]
  onAddLawyer: (input: {
    userId: number
    displayName: string
    letterTypeIds: string[]
  }) => Promise<void>
  onUpdateLawyerMaxInFlight: (lawyerId: string, maxInFlight: number) => Promise<void>
  onUpdateLawyerLetterTypes: (lawyerId: string, letterTypeIds: string[]) => Promise<void>
  isSaving?: boolean
  savingLawyerId?: string | null
  onAddLetterType: (onCreated?: (typeId: string) => void) => void
  readOnly?: boolean
}

export function LawyersPanel({
  lawyers,
  letterTypes,
  availableUsers,
  onAddLawyer,
  onUpdateLawyerMaxInFlight,
  onUpdateLawyerLetterTypes,
  isSaving = false,
  savingLawyerId = null,
  onAddLetterType,
  readOnly = false,
}: LawyersPanelProps) {
  const { t } = useTranslation('common')
  const [addLawyerOpen, setAddLawyerOpen] = useState(false)

  const handleAddLawyer = async (input: {
    userId: number
    displayName: string
    letterTypeIds: string[]
  }) => {
    try {
      await onAddLawyer(input)
    } catch {
      toast.error(
        t('pages.lawyerWorkplace.settings.modals.addLawyer.error', 'Could not add lawyer')
      )
    }
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
        <AutoAssignmentCard />
        <LawyersTable
          lawyers={lawyers}
          letterTypes={letterTypes}
          onUpdateLawyerMaxInFlight={onUpdateLawyerMaxInFlight}
          onUpdateLawyerLetterTypes={onUpdateLawyerLetterTypes}
          isSaving={isSaving}
          savingLawyerId={savingLawyerId}
          onAddLawyer={() => setAddLawyerOpen(true)}
          readOnly={readOnly}
        />
      </div>

      <AddLawyerModal
        open={addLawyerOpen}
        onClose={() => setAddLawyerOpen(false)}
        letterTypes={letterTypes}
        availableUsers={availableUsers}
        onAdd={handleAddLawyer}
        isSubmitting={isSaving}
        onAddLetterType={onAddLetterType}
      />
    </>
  )
}
