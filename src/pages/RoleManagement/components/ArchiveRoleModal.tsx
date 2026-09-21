/**
 * ArchiveRoleModal Component
 *
 * Modal for archiving a role with user reassignment options.
 * Matches the design with user list, reassignment options, and validation.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
import { ModalSkeleton } from '@/components/ui/ModalSkeleton'
import { useRole } from '@/features/roles/hooks/useRole'
import { useRoleUsers, useArchiveRole } from '@/features/roles/hooks/useRoleMutations'
import { useRoles } from '@/features/roles/hooks/useRoles'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/Select'
import { Checkbox } from '@/components/ui/Checkbox'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Icons } from '@/lib/icons'
import { piiProps } from '@/lib/openreplay/pii'

interface ArchiveRoleModalProps {
  open: boolean
  roleId: number
  onClose: () => void
  onSuccess: () => void
}

type ReassignmentOption = 'reassign' | 'default'

export function ArchiveRoleModal({ open, roleId, onClose, onSuccess }: ArchiveRoleModalProps) {
  const { t } = useTranslation('common')
  const { data: role, isLoading: roleLoading, error: roleError } = useRole(roleId)
  // Users query is optional - if it fails, we'll just show empty list
  const { data: usersData, isLoading: usersLoading, error: usersError } = useRoleUsers(roleId)
  const archiveMutation = useArchiveRole()

  // Get available roles in the same project for reassignment
  const { data: rolesData } = useRoles({
    page: 1,
    page_size: 100,
    project_id: role?.project_id || undefined,
    is_active: true,
  })

  const availableRoles = useMemo(() => {
    if (!rolesData?.roles || !role) return []
    // Filter out the current role and only show active roles in the same project
    return rolesData.roles.filter((r) => r.id !== role.id && r.is_active)
  }, [rolesData, role])

  // Get default Operator role
  const defaultOperatorRole = useMemo(() => {
    if (!rolesData?.roles || !role) return null
    return rolesData.roles.find(
      (r) => r.project_id === role.project_id && r.name === 'Operator' && r.is_default
    )
  }, [rolesData, role])

  const [reassignmentOption, setReassignmentOption] = useState<ReassignmentOption>('default')
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)

  // Handle case where users query fails (404) - treat as no users
  const users = usersError ? [] : usersData?.users || []
  const hasUsers = users.length > 0
  // Can archive if: no users OR (has users and reassignment is properly configured)
  const canArchive =
    !hasUsers ||
    (reassignmentOption === 'default' && defaultOperatorRole) ||
    (reassignmentOption === 'reassign' && selectedRoleId)

  const handleArchive = () => {
    if (!role || !canArchive) return

    const archiveData: { reassign_to_role_id?: number; use_default_role?: boolean } = {}

    // Only include reassignment data if users exist
    if (hasUsers) {
      if (reassignmentOption === 'default' && defaultOperatorRole) {
        archiveData.use_default_role = true
      } else if (reassignmentOption === 'reassign' && selectedRoleId) {
        archiveData.reassign_to_role_id = selectedRoleId
        archiveData.use_default_role = false
      }
    }

    archiveMutation.mutate(
      {
        roleId: role.id,
        data: archiveData,
      },
      {
        onSuccess: () => {
          onSuccess()
          onClose()
        },
      }
    )
  }

  const isLoading = roleLoading || usersLoading

  return (
    <Modal open={open} onClose={onClose} maxWidth="2xl">
      <ModalHeader
        icon={
          <div className="bg-primary-400 flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8">
            <Icons.Delete size={18} className="text-foreground" strokeWidth={2} />
          </div>
        }
        title={
          role
            ? t('pages.roles.modals.archive.title', { roleName: role.name })
            : t('pages.roles.modals.archive.defaultTitle')
        }
      />
      <ModalContent>
        {isLoading ? (
          <ModalSkeleton />
        ) : roleError || usersError ? (
          <Alert variant="error">
            <p className="text-sm">
              {roleError?.message ||
                usersError?.message ||
                t('pages.roles.modals.archive.failedToLoad')}
            </p>
          </Alert>
        ) : role ? (
          <div className="space-y-6">
            {/* Assigned Users Section */}
            {hasUsers ? (
              <div>
                <p className="text-foreground mb-3 text-sm font-light">
                  {t('pages.roles.modals.archive.hasUsersAssigned')}
                </p>
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center gap-3">
                      <Checkbox checked={true} disabled />
                      {/* The login and the name arrive as one string. The login
                          is not personal data, but splitting the two to keep it
                          readable would be a logic change in a markup PR. */}
                      <span className="text-foreground text-sm font-light" {...piiProps}>
                        {user.username}
                        {user.full_name ? ` (${user.full_name})` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-foreground text-sm font-light">
                  {t('pages.roles.modals.archive.noUsersCanArchive')}
                </p>
              </div>
            )}

            {/* Role per Project Section */}
            {hasUsers && (
              <div className="space-y-4">
                <hr className="border-border border-t" />
                <p className="text-foreground text-sm font-light">
                  {t('pages.roles.modals.archive.reassignmentOptions')}
                </p>

                <div className="space-y-4">
                  {/* Reassign to option - first line */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none ${
                        reassignmentOption === 'reassign'
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-border bg-transparent'
                      }`}
                      onClick={() => setReassignmentOption('reassign')}
                    >
                      {reassignmentOption === 'reassign' && (
                        <div className="bg-primary-foreground h-2 w-2 rounded-full" />
                      )}
                    </button>
                    <div
                      className="flex flex-1 cursor-pointer items-center gap-2"
                      onClick={() => setReassignmentOption('reassign')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setReassignmentOption('reassign')
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="text-foreground w-1/2 text-sm font-light">
                        {t('pages.roles.modals.archive.reassignTo')}
                      </span>
                      <div
                        className="w-1/2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                        role="presentation"
                      >
                        <Select
                          value={
                            reassignmentOption === 'reassign'
                              ? selectedRoleId?.toString() || ''
                              : ''
                          }
                          onValueChange={(value) => setSelectedRoleId(Number(value))}
                          disabled={reassignmentOption !== 'reassign'}
                        >
                          <SelectTrigger
                            className={`w-full ${reassignmentOption !== 'reassign' ? 'cursor-default opacity-50' : 'cursor-pointer'}`}
                          >
                            <SelectValue placeholder={t('pages.roles.modals.archive.selectRole')} />
                          </SelectTrigger>
                          <SelectContent>
                            {availableRoles.map((r) => (
                              <SelectItem key={r.id} value={r.id.toString()}>
                                {r.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Set to default option - second line */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none ${
                        reassignmentOption === 'default'
                          ? 'border-primary-500 bg-primary-500'
                          : 'border-border bg-transparent'
                      }`}
                      onClick={() => setReassignmentOption('default')}
                    >
                      {reassignmentOption === 'default' && (
                        <div className="bg-primary-foreground h-2 w-2 rounded-full" />
                      )}
                    </button>
                    <div
                      className="flex flex-1 cursor-pointer items-center gap-2"
                      onClick={() => setReassignmentOption('default')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setReassignmentOption('default')
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <span className="text-foreground w-1/2 text-sm font-light">
                        {t('pages.roles.modals.archive.setToDefault')}
                      </span>
                      <span className="text-foreground w-1/2 text-sm font-light">
                        {defaultOperatorRole?.name || 'Operator'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {hasUsers && !canArchive && (
              <Alert variant="error">
                <div className="flex items-center gap-2">
                  <Icons.Warning size={16} className="text-error-500" />
                  <p className="text-error-500 text-sm">
                    {t('pages.roles.modals.archive.cannotArchiveUntilReassigned')}
                  </p>
                </div>
              </Alert>
            )}

            {/* Error from API */}
            {archiveMutation.isError && (
              <Alert variant="error">
                <p className="text-sm">
                  {archiveMutation.error?.message ||
                    t('pages.roles.modals.archive.failedToArchive')}
                </p>
              </Alert>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground py-8 text-center">
            {t('pages.roles.modals.archive.roleNotFound')}
          </div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button type="button" variant="cancel" onClick={onClose}>
          {t('actions.cancel')}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleArchive}
          disabled={!canArchive || archiveMutation.isPending || isLoading}
          className={`text-primary-foreground bg-primary-300 h-[45px] flex-1 rounded-md border-none text-sm font-medium ${!canArchive ? 'opacity-50' : ''}`}
        >
          {archiveMutation.isPending
            ? t('pages.roles.modals.archive.archiving')
            : t('pages.roles.modals.archive.archiveRole')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
