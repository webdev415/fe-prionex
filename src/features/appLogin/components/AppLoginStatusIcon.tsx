/**
 * Read-only «phone bound» indicator for the User Management table, next to the
 * Google Authenticator icon. Coloured = at least one phone bound.
 */

import { useTranslation } from 'react-i18next'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/Tooltip'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'

interface AppLoginStatusIconProps {
  enabled: boolean
  className?: string
}

export function AppLoginStatusIcon({ enabled, className }: AppLoginStatusIconProps) {
  const { t } = useTranslation('common')
  const tooltip = enabled
    ? t('pages.users.appLoginIndicator.enabled')
    : t('pages.users.appLoginIndicator.disabled')

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn('inline-flex items-center justify-center', className)}
          aria-label={tooltip}
        >
          <Icons.Phone
            size={16}
            strokeWidth={1.8}
            className={cn('shrink-0', enabled ? 'text-success-600' : 'opacity-45 grayscale')}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{tooltip}</TooltipContent>
    </Tooltip>
  )
}

export default AppLoginStatusIcon
