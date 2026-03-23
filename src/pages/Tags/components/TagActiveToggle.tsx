/**
 * TagActiveToggle Component
 *
 * Inline toggle switch for DataTable rows to enable/disable tags.
 */

import { useTranslation } from 'react-i18next'
import { ToggleSwitch } from '@/components/ui/ToggleSwitch'

export interface TagActiveToggleProps {
  tagId: number
  isActive: boolean
  onToggle: (tagId: number, isActive: boolean) => void
}

export function TagActiveToggle({ tagId, isActive, onToggle }: TagActiveToggleProps) {
  const { t } = useTranslation('common')

  return (
    <ToggleSwitch
      checked={isActive}
      onChange={(checked) => onToggle(tagId, checked)}
      ariaLabel={
        isActive
          ? t('pages.tags.deactivateTag', 'Deactivate tag')
          : t('pages.tags.activateTag', 'Activate tag')
      }
    />
  )
}
