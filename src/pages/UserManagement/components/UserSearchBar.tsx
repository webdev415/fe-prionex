/**
 * UserSearchBar Component
 *
 * Search bar with criterion selector for User Management.
 * Matches the client SearchBar layout; search runs while typing, on button click, or Enter.
 */

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import type { UserSearchField } from '@/features/users/types'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

export interface UserSearchOption {
  value: UserSearchField
  label: string
}

interface UserSearchBarProps {
  value: string
  searchField: UserSearchField
  onValueChange: (value: string) => void
  onSearchFieldChange: (field: UserSearchField) => void
  onSearch: () => void
  onClear: () => void
}

export function UserSearchBar({
  value,
  searchField,
  onValueChange,
  onSearchFieldChange,
  onSearch,
  onClear,
}: UserSearchBarProps) {
  const { t } = useTranslation('common')
  const [isMobileDropdownOpen, setIsMobileDropdownOpen] = useState(false)
  const [isDesktopDropdownOpen, setIsDesktopDropdownOpen] = useState(false)

  const searchOptions: UserSearchOption[] = [
    { value: 'full_name', label: t('pages.users.searchCriteria.fullName') },
    { value: 'username', label: t('pages.users.searchCriteria.username') },
    { value: 'email', label: t('pages.users.searchCriteria.email') },
    { value: 'extension', label: t('pages.users.searchCriteria.extension') },
  ]

  const currentSearchFieldLabel =
    searchOptions.find((option) => option.value === searchField)?.label ?? ''

  useEffect(() => {
    let wasMobile = window.innerWidth < 1024

    const handleResize = () => {
      const isMobile = window.innerWidth < 1024
      if (wasMobile !== isMobile && isMobileDropdownOpen) {
        setIsMobileDropdownOpen(false)
      }
      wasMobile = isMobile
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isMobileDropdownOpen])

  useEffect(() => {
    const handleResize = () => {
      if (isDesktopDropdownOpen) {
        setIsDesktopDropdownOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isDesktopDropdownOpen])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      onSearch()
    }
  }

  const handleSearchFieldChange = (field: UserSearchField) => {
    onSearchFieldChange(field)
  }

  return (
    <div className="border-border bg-card flex w-full items-center gap-3 rounded-full border pr-2 pl-4">
      <div className="flex min-w-0 flex-1 items-center gap-2 py-1">
        <input
          type="text"
          placeholder={t('pages.users.searchPlaceholder')}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onKeyDown={handleKeyDown}
          className="text-foreground placeholder:text-muted-foreground h-9 w-full min-w-0 bg-transparent text-sm font-light outline-none"
        />
        {value && (
          <button
            onClick={onClear}
            className="hover:bg-muted flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors"
            type="button"
            aria-label={t('pages.users.clearSearch')}
          >
            <Icons.Close size={14} className="text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center">
        <div className="lg:hidden">
          <DropdownMenu
            modal={false}
            open={isMobileDropdownOpen}
            onOpenChange={setIsMobileDropdownOpen}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-primary-foreground bg-primary-300 hover:bg-primary-500 active:bg-primary-600 group flex h-9 w-9 min-w-0 cursor-pointer items-center justify-center rounded-full border-0 p-0 shadow-none transition-all duration-200 hover:shadow-md focus:outline-none active:shadow-sm disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:focus:ring-0 data-[state=open]:focus:ring-offset-0"
                aria-label={t('pages.users.searchCriterionLabel')}
              >
                <Icons.Filter
                  size={18}
                  className="text-primary-foreground shrink-0 transition-transform duration-200 group-hover:scale-110"
                  strokeWidth={1.5}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {searchOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSearchFieldChange(option.value)}
                  className={cn(
                    'text-foreground flex cursor-pointer items-center gap-2 text-xs',
                    searchField === option.value && 'bg-muted font-medium'
                  )}
                >
                  {option.label}
                  {searchField === option.value && (
                    <Icons.Checkmark
                      size={16}
                      className="text-foreground ml-auto"
                      strokeWidth={2}
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="hidden items-center lg:flex">
          <div className="bg-border mx-2 h-5 w-px" />
          <DropdownMenu
            modal={false}
            open={isDesktopDropdownOpen}
            onOpenChange={setIsDesktopDropdownOpen}
          >
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-foreground hover:bg-muted active:bg-muted group flex h-auto w-auto min-w-[140px] cursor-pointer items-center justify-between gap-2 rounded-md border-0 bg-transparent px-2 py-1 text-xs shadow-none transition-all duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:focus:ring-0 data-[state=open]:focus:ring-offset-0"
                aria-label={t('pages.users.searchCriterionLabel')}
              >
                <span className="transition-colors duration-200">{currentSearchFieldLabel}</span>
                <Icons.ArrowDown
                  size={14}
                  className="text-muted-foreground opacity-50 transition-all duration-200 group-hover:translate-y-0.5 group-hover:opacity-100"
                  strokeWidth={1.5}
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {searchOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSearchFieldChange(option.value)}
                  className={cn(
                    'text-foreground flex cursor-pointer items-center gap-2 text-xs',
                    searchField === option.value && 'bg-muted font-medium'
                  )}
                >
                  {option.label}
                  {searchField === option.value && (
                    <Icons.Checkmark
                      size={16}
                      className="text-foreground ml-auto"
                      strokeWidth={2}
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
