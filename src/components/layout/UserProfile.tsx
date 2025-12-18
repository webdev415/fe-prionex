/**
 * UserProfile Component
 *
 * User profile dropdown with user info, settings, and logout option.
 */

import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Icons } from '@/lib/icons'
import { useAuth } from '@/features/auth'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

interface UserProfileProps {
  onLogoutClick?: () => void
}

export function UserProfile({ onLogoutClick }: UserProfileProps) {
  const { t } = useTranslation('common')
  const { user } = useAuth()

  // Get display name: prefer firstName + lastName, fallback to username
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username || 'User'

  const handleSettingsClick = () => {
    // TODO: Navigate to settings page or open settings modal
    console.log('Settings clicked')
    toast.info(t('navigation.settings'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="bg-primary-300 flex h-10 w-[175px] items-center gap-2 rounded-md px-3 transition-all duration-200 hover:opacity-90">
          <Icons.User02 size={20} className="text-dark-500" strokeWidth={1.5} />
          <span className="text-dark-500 flex-1 truncate text-left text-xs font-medium">
            {displayName}
          </span>
          <Icons.ArrowDown size={16} className="text-dark-500" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[175px] bg-white">
        {/* Settings */}
        <DropdownMenuItem
          onClick={handleSettingsClick}
          className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
        >
          <Icons.Setting07 size={16} className="text-dark-500" />
          <span>{t('navigation.settings')}</span>
        </DropdownMenuItem>

        {/* Logout */}
        <DropdownMenuItem
          onClick={onLogoutClick}
          className="text-dark-500 flex cursor-pointer items-center gap-2 text-sm"
        >
          <Icons.Logout size={16} className="text-dark-500" />
          <span>{t('actions.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
