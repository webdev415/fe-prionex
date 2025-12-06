/**
 * UserProfile Component
 *
 * User profile dropdown with user info and logout option.
 */

import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
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
  const { user } = useAuth()

  // Get display name: prefer firstName + lastName, fallback to username
  const displayName =
    user?.firstName && user?.lastName
      ? `${user.firstName} ${user.lastName}`
      : user?.username || 'User'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex h-10 w-[175px] items-center gap-2 rounded-md px-3 transition-all duration-200 hover:opacity-90"
          style={{
            backgroundColor: colors.primary[300],
          }}
        >
          <Icons.User02 size={20} color={colors.neutral.dark[500]} strokeWidth={1.5} />
          <span
            className="flex-1 truncate text-left font-medium"
            style={{
              fontSize: '12px',
              color: colors.neutral.dark[500],
            }}
          >
            {displayName}
          </span>
          <Icons.ArrowDown size={16} color={colors.neutral.dark[500]} strokeWidth={1.5} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[175px] bg-white">
        <DropdownMenuItem
          onClick={onLogoutClick}
          className="cursor-pointer flex items-center gap-2"
          style={{ 
            color: colors.neutral.dark[500],
            fontSize: '14px',
          }}
        >
          <Icons.Logout size={16} color={colors.neutral.dark[500]} />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

