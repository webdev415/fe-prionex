/**
 * ProjectDetailPanel Component
 *
 * Side panel that displays detailed project information.
 * Slides in from the right when a project is selected.
 */

import { useEffect, useState } from 'react'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatNumber, formatDateTime, truncateText } from '@/lib/formatters'
import type { ApiProjectDetail } from '@/features/projects/types'

interface ProjectDetailPanelProps {
  project: ApiProjectDetail | null
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  onManageUsersRoles: () => void
  isLoading?: boolean
}

export function ProjectDetailPanel({
  project,
  isOpen,
  onClose,
  onEdit,
  onManageUsersRoles,
  isLoading = false,
}: ProjectDetailPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // Get status type for badge
  const getStatusType = (status: string): 'active' | 'disabled' | 'inactive' | 'archived' => {
    switch (status) {
      case 'active':
        return 'active'
      case 'archived':
        return 'archived'
      case 'inactive':
        return 'inactive'
      default:
        return 'disabled'
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 lg:hidden"
        onClick={onClose}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
        role="button"
        tabIndex={0}
        aria-label="Close panel"
      />

      {/* Panel */}
      <div
        className={`fixed top-0 right-0 z-50 h-full w-full max-w-[400px] transform bg-white shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Loading State */}
        {isLoading && (
          <div className="flex h-full items-center justify-center">
            <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2" />
          </div>
        )}

        {/* Content */}
        {!isLoading && project && (
          <div className="flex h-full flex-col overflow-hidden">
            {/* Header */}
            <div
              className="flex items-center justify-between border-b px-6 py-4"
              style={{ borderColor: colors.gray[200] }}
            >
              <div className="flex items-center gap-3">
                <StatusBadge status={getStatusType(project.status)} />
                <h2
                  className="max-w-[250px] truncate text-lg font-medium"
                  style={{ color: colors.neutral.dark[500] }}
                  title={project.name}
                >
                  {project.name}
                </h2>
              </div>
              <button
                onClick={onClose}
                className="rounded-lg p-2 transition-colors hover:bg-gray-100"
              >
                <Icons.Close size={20} color={colors.gray[500]} />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Basic Info */}
              <div className="border-b px-6 py-4" style={{ borderColor: colors.gray[200] }}>
                <div className="grid grid-cols-2 gap-4">
                  <InfoItem label="Code" value={project.code} />
                  <InfoItem label="Contract" value={project.contract_number} />
                  <InfoItem label="Client" value={project.client_company} />
                  <InfoItem label="Users" value={project.user_count?.toString()} />
                </div>
              </div>

              {/* Metrics */}
              <div className="border-b px-6 py-4" style={{ borderColor: colors.gray[200] }}>
                <h3 className="mb-3 text-sm font-medium" style={{ color: colors.gray[600] }}>
                  Metrics
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <MetricCard label="Clients" value={formatNumber(project.total_clients)} />
                  <MetricCard
                    label="Total Debt"
                    value={formatCurrency(project.total_debt_amount)}
                  />
                </div>
              </div>

              {/* Description */}
              {project.description && (
                <div className="border-b px-6 py-4" style={{ borderColor: colors.gray[200] }}>
                  <h3 className="mb-2 text-sm font-medium" style={{ color: colors.gray[600] }}>
                    Description
                  </h3>
                  <p className="text-sm font-light" style={{ color: colors.gray[700] }}>
                    {isExpanded ? project.description : truncateText(project.description, 150)}
                  </p>
                  {project.description.length > 150 && (
                    <button
                      onClick={() => setIsExpanded(!isExpanded)}
                      className="mt-2 text-sm font-medium"
                      style={{ color: colors.primary[500] }}
                    >
                      {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                  )}
                </div>
              )}

              {/* Access and Roles */}
              <div className="border-b px-6 py-4" style={{ borderColor: colors.gray[200] }}>
                <h3 className="mb-3 text-sm font-medium" style={{ color: colors.gray[600] }}>
                  Access and Roles
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-light" style={{ color: colors.gray[600] }}>
                      Assigned users
                    </span>
                    <span className="text-sm font-medium" style={{ color: colors.gray[900] }}>
                      {project.assigned_users_count || project.statistics?.user_count || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-light" style={{ color: colors.gray[600] }}>
                      Default roles
                    </span>
                    <span
                      className="max-w-[200px] truncate text-right text-sm font-medium"
                      style={{ color: colors.gray[900] }}
                      title={project.default_roles?.join(', ')}
                    >
                      {project.default_roles?.join(', ') || 'None'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onManageUsersRoles}
                  className="mt-4 flex items-center gap-2 text-sm font-medium"
                  style={{ color: colors.primary[500] }}
                >
                  <Icons.Users size={16} color={colors.primary[500]} />
                  Manage users & roles
                  <Icons.ArrowRight size={16} color={colors.primary[500]} />
                </button>
              </div>

              {/* Audit */}
              <div className="px-6 py-4">
                <h3 className="mb-3 text-sm font-medium" style={{ color: colors.gray[600] }}>
                  Audit
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-light" style={{ color: colors.gray[600] }}>
                      Created by
                    </span>
                    <span className="text-sm font-medium" style={{ color: colors.gray[900] }}>
                      {project.created_by?.username || 'System'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-light" style={{ color: colors.gray[600] }}>
                      Created
                    </span>
                    <span className="text-sm font-medium" style={{ color: colors.gray[900] }}>
                      {formatDateTime(project.created_at)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-light" style={{ color: colors.gray[600] }}>
                      Last updated
                    </span>
                    <span className="text-sm font-medium" style={{ color: colors.gray[900] }}>
                      {formatDateTime(project.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div
              className="flex gap-3 border-t px-6 py-4"
              style={{ borderColor: colors.gray[200] }}
            >
              <button
                onClick={onEdit}
                className="h-[45px] flex-1 rounded-lg border text-sm font-medium transition-colors hover:bg-gray-50"
                style={{
                  borderColor: colors.gray[400],
                  color: colors.gray[700],
                }}
              >
                Edit Project
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

// Helper component for info items
function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-light" style={{ color: colors.gray[500] }}>
        {label}
      </span>
      <span className="text-sm font-medium" style={{ color: colors.gray[900] }}>
        {value || '—'}
      </span>
    </div>
  )
}

// Helper component for metric cards
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: colors.gray[100] }}>
      <span className="mb-1 block text-xs font-light" style={{ color: colors.gray[500] }}>
        {label}
      </span>
      <span className="text-lg font-medium" style={{ color: colors.gray[900] }}>
        {value}
      </span>
    </div>
  )
}

export default ProjectDetailPanel
