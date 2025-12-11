/**
 * ArchiveRoleModal Component
 *
 * Modal for archiving a role with user reassignment options.
 * Matches the design with user list, reassignment options, and validation.
 */

import { useState, useMemo } from 'react'
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'
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

interface ArchiveRoleModalProps {
  open: boolean
  roleId: number
  onClose: () => void
  onSuccess: () => void
}

type ReassignmentOption = 'reassign' | 'default'

export function ArchiveRoleModal({ open, roleId, onClose, onSuccess }: ArchiveRoleModalProps) {
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
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: '#B0EDC7' }}
          >
            <Icons.Delete size={20} color="#1A1A1A" strokeWidth={2} />
          </div>
        }
        title={role ? `Archive Role: ${role.name}` : 'Archive Role'}
      />
      <ModalContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-teal-600" />
            <span className="ml-3 text-gray-600">Loading role data...</span>
          </div>
        ) : roleError || usersError ? (
          <Alert variant="error">
            <p className="text-sm">
              {roleError?.message ||
                usersError?.message ||
                'Failed to load role data. Please try again.'}
            </p>
          </Alert>
        ) : role ? (
          <div className="space-y-6">
            {/* Assigned Users Section */}
            {hasUsers ? (
              <div>
                <p
                  className="mb-3 font-light"
                  style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                >
                  This role has users assigned:
                </p>
                <div className="space-y-2">
                  {users.map((user) => (
                    <div key={user.id} className="flex items-center gap-3">
                      <Checkbox checked={true} disabled />
                      <span
                        className="font-light"
                        style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                      >
                        {user.username}
                        {user.first_name || user.last_name
                          ? ` (${[user.first_name, user.last_name].filter(Boolean).join(' ')})`
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p
                  className="font-light"
                  style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                >
                  This role has no users assigned. You can archive it directly.
                </p>
              </div>
            )}

            {/* Role per Project Section */}
            {hasUsers && (
              <div className="space-y-4">
                <hr className="border-t" style={{ borderColor: '#F2F3F0' }} />
                <p
                  className="font-light"
                  style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                >
                  Role per Project:
                </p>

                <div className="space-y-4">
                  {/* Reassign to option - first line */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none"
                      style={{
                        borderColor: reassignmentOption === 'reassign' ? '#0CA8EB' : '#D1D5DB',
                        backgroundColor:
                          reassignmentOption === 'reassign' ? '#0CA8EB' : 'transparent',
                      }}
                      onClick={() => setReassignmentOption('reassign')}
                    >
                      {reassignmentOption === 'reassign' && (
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: '#FFFFFF' }}
                        />
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
                      <span
                        className="w-1/2 font-light"
                        style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                      >
                        Reassign to:
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
                            className="w-full"
                            style={{
                              opacity: reassignmentOption !== 'reassign' ? 0.5 : 1,
                              cursor: reassignmentOption !== 'reassign' ? 'default' : 'pointer',
                            }}
                          >
                            <SelectValue placeholder="Select Role" />
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
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 focus:outline-none"
                      style={{
                        borderColor: reassignmentOption === 'default' ? '#0CA8EB' : '#D1D5DB',
                        backgroundColor:
                          reassignmentOption === 'default' ? '#0CA8EB' : 'transparent',
                      }}
                      onClick={() => setReassignmentOption('default')}
                    >
                      {reassignmentOption === 'default' && (
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: '#FFFFFF' }}
                        />
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
                      <span
                        className="w-1/2 font-light"
                        style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                      >
                        Set to default:
                      </span>
                      <span
                        className="w-1/2 font-light"
                        style={{ fontSize: '14px', fontWeight: 300, color: '#030712' }}
                      >
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
                  <Icons.Warning size={16} color="#EF4444" />
                  <p className="text-sm" style={{ color: '#EF4444' }}>
                    You cannot archive a role until all users are reassigned.
                  </p>
                </div>
              </Alert>
            )}

            {/* Error from API */}
            {archiveMutation.isError && (
              <Alert variant="error">
                <p className="text-sm">
                  {archiveMutation.error?.message || 'Failed to archive role. Please try again.'}
                </p>
              </Alert>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-600">Role not found</div>
        )}
      </ModalContent>
      <ModalFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: '#6B7280',
            color: '#FFFFFF',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={handleArchive}
          disabled={!canArchive || archiveMutation.isPending || isLoading}
          className="flex-1 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: '#A7E8BD',
            color: '#1A1A1A',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
            opacity: !canArchive ? 0.5 : 1,
          }}
        >
          Archive Role
        </Button>
      </ModalFooter>
    </Modal>
  )
}
