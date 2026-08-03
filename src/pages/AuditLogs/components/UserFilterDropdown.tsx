/**
 * UserFilterDropdown Component
 *
 * Dropdown with search functionality for selecting users.
 * Supports "All Users" option and individual user selection with checkboxes.
 */

import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { Icons } from '@/lib/icons'

interface UserFilterDropdownProps {
  users: string[]
  selectedUsers: string[] // Array of selected usernames
  onUserChange: (users: string[]) => void
  trigger: React.ReactNode
  disabled?: boolean
}

export function UserFilterDropdown({
  users,
  selectedUsers,
  onUserChange,
  trigger,
  disabled = false,
}: UserFilterDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [triggerWidth, setTriggerWidth] = useState<number | undefined>(undefined)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return users
    return users.filter((user) => user.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [users, searchQuery])

  // Function to measure and update trigger width
  const updateTriggerWidth = useCallback(() => {
    if (wrapperRef.current) {
      // Find the actual trigger button inside the wrapper
      const triggerButton = wrapperRef.current.querySelector('button')
      if (triggerButton) {
        const width = triggerButton.offsetWidth
        setTriggerWidth(width)
      }
    }
  }, [])

  // Handle open change
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setIsOpen(open)
      if (!open) {
        setSearchQuery('')
      } else {
        // Measure trigger width after DOM updates
        requestAnimationFrame(() => {
          updateTriggerWidth()
        })
      }
    },
    [updateTriggerWidth]
  )

  // Update trigger width when window is resized and dropdown is open
  useEffect(() => {
    if (!isOpen) return

    const handleResize = () => {
      updateTriggerWidth()
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen, updateTriggerWidth])

  const handleToggleUser = (user: string) => {
    if (user === 'all') {
      // Toggle "All Users" - if all users are selected, deselect all; otherwise select all
      if (selectedUsers.length === users.length) {
        onUserChange([]) // Deselect all
      } else {
        onUserChange([...users]) // Select all users
      }
    } else {
      // Toggle individual user
      if (selectedUsers.includes(user)) {
        // Deselect this user
        onUserChange(selectedUsers.filter((u) => u !== user))
      } else {
        // Select this user
        onUserChange([...selectedUsers, user])
      }
    }
    // Don't close dropdown to allow multiple selections
  }

  // "All Users" is selected when all users are selected
  const isAllUsersSelected = selectedUsers.length === users.length && users.length > 0
  // Individual user is selected when it's in the selectedUsers array
  const isUserSelected = (user: string) => selectedUsers.includes(user)

  return (
    <div ref={wrapperRef} className="w-full">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange} modal={false}>
        <div className="w-full">
          <DropdownMenuTrigger asChild className="w-full outline-none" disabled={disabled}>
            {trigger}
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent
          align="start"
          sideOffset={8}
          style={{ width: triggerWidth ? `${triggerWidth}px` : undefined }}
          className="border-border bg-card max-w-[calc(100vw-2rem)] rounded-md border p-0 shadow-lg sm:max-w-none"
        >
          {/* Search Input */}
          <div className="border-border border-b p-3">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="text-foreground focus:border-primary-500 border-border bg-card placeholder:text-muted-foreground w-full rounded-lg border px-3 py-2 pr-10 text-sm outline-none"
              />
              <Icons.Search
                size={16}
                className="text-muted-foreground absolute top-1/2 right-3 -translate-y-1/2"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* User List */}
          <div className="max-h-[200px] overflow-y-auto sm:max-h-[300px]">
            {filteredUsers.length === 0 && searchQuery ? (
              <div className="text-muted-foreground py-4 text-center text-sm">
                {t('common.noUsersFound')}
              </div>
            ) : (
              <div className="divide-border divide-y">
                {/* All Users Option */}
                <label className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-3 px-3 py-2.5">
                  <Checkbox
                    checked={isAllUsersSelected}
                    onCheckedChange={() => handleToggleUser('all')}
                  />
                  <span className="text-sm font-medium">
                    {t('pages.auditLogs.searchFilters.allUsers')}
                  </span>
                </label>

                {/* Individual Users */}
                {filteredUsers.map((user) => (
                  <label
                    key={user}
                    className="text-foreground hover:bg-muted flex cursor-pointer items-center gap-3 px-3 py-2.5"
                  >
                    <Checkbox
                      checked={isUserSelected(user)}
                      onCheckedChange={() => handleToggleUser(user)}
                    />
                    <span className="text-sm">{user}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
