import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { useAuth } from '@/features/auth'
import { getUserDisplayName } from '@/lib/mapBackendUser'
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
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()

  const displayName = getUserDisplayName(user)

  useEffect(() => {
    const handleResize = () => {
      if (isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

  const handleSettingsClick = () => {
    setIsOpen(false)
    navigate('/dashboard/profile')
  }

  return (
    <DropdownMenu modal={false} open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button className="bg-secondary-800 flex h-10 w-[175px] cursor-pointer items-center gap-2 rounded-md px-3 transition-all duration-200 hover:opacity-90">
          <Icons.User02 size={20} className="text-primary-500" strokeWidth={1.5} />
          <span className="flex-1 truncate text-left text-xs font-medium text-white">
            {displayName}
          </span>
          <Icons.ArrowDown size={16} className="text-white" strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[175px]">
        <DropdownMenuItem
          onClick={handleSettingsClick}
          className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
        >
          <Icons.SlidersHorizontal size={16} className="text-foreground" />
          <span>{t('navigation.profile')}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={onLogoutClick}
          className="text-foreground flex cursor-pointer items-center gap-2 text-sm"
        >
          <Icons.Logout size={16} className="text-foreground" />
          <span>{t('actions.logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
