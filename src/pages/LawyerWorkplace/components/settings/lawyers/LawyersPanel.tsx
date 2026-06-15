import { useState } from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import type { LetterTypeConfig } from '../../../settings/types'
import type { SettingsLawyer } from '../../../settings/types'
import { mapLawyerOptionToSettingsLawyer } from '../../../settings/utils/lawyerHelpers'
import { AddLawyerModal } from './AddLawyerModal'
import { AutoAssignmentCard } from './AutoAssignmentCard'
import { LawyersTable } from './LawyersTable'

interface LawyersPanelProps {
  lawyers: SettingsLawyer[]
  letterTypes: LetterTypeConfig[]
  onLawyersChange: (lawyers: SettingsLawyer[]) => void
  onAddLetterType: (onCreated?: (typeId: string) => void) => void
}

export function LawyersPanel({
  lawyers,
  letterTypes,
  onLawyersChange,
  onAddLetterType,
}: LawyersPanelProps) {
  const { t } = useTranslation('common')
  const [addLawyerOpen, setAddLawyerOpen] = useState(false)

  const handleAddLawyer = (input: { lawyerOptionId: string; letterTypeIds: string[] }) => {
    const newLawyer = mapLawyerOptionToSettingsLawyer(input.lawyerOptionId, input.letterTypeIds)
    if (!newLawyer) return
    onLawyersChange([...lawyers, newLawyer])
    toast.success(t('pages.lawyerWorkplace.settings.modals.addLawyer.success', 'Lawyer added'))
  }

  return (
    <>
      <div className="space-y-5 px-4 pb-6 sm:px-5 lg:px-7">
        <AutoAssignmentCard />
        <LawyersTable
          lawyers={lawyers}
          letterTypes={letterTypes}
          onLawyersChange={onLawyersChange}
          onAddLawyer={() => setAddLawyerOpen(true)}
        />
      </div>

      <AddLawyerModal
        open={addLawyerOpen}
        onClose={() => setAddLawyerOpen(false)}
        letterTypes={letterTypes}
        existingLawyerIds={lawyers.map((lawyer) => lawyer.id)}
        onAdd={handleAddLawyer}
        onAddLetterType={onAddLetterType}
      />
    </>
  )
}
