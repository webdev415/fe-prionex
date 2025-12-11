/**
 * ProjectDetailPanel Component
 *
 * Inline panel that displays detailed project information.
 * Sits in the 30% width area next to the DataTable.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatNumber, formatDateTime, truncateText } from '@/lib/formatters'
import type { ApiProjectDetail } from '@/features/projects/types'

interface ProjectDetailPanelProps {
  project: ApiProjectDetail | null
  hasProjects: boolean
  onEdit: () => void
  onDelete: () => void
  isLoading?: boolean
}

export function ProjectDetailPanel({
  project,
  hasProjects,
  onEdit,
  onDelete,
  isLoading = false,
}: ProjectDetailPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const navigate = useNavigate()

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

  // Empty state when there are no projects
  if (!hasProjects) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-lg border border-gray-200 bg-white/50 p-6">
        <Icons.View size={48} color="#D1D5DB" strokeWidth={1} />
        <p className="mt-4 text-sm text-gray-500">There is no project</p>
      </div>
    )
  }

  // Loading state
  if (isLoading || !project) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-gray-200 bg-white">
        <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-b-2" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 bg-white/50 p-6">
      {/* Header */}
      <div className="flex items-center border-none">
        <div className="flex items-center gap-2">
          <StatusBadge status={getStatusType(project.status)} />
          <h2
            className="text-dark-950 max-w-[180px] truncate text-base font-medium"
            title={project.name}
          >
            {project.name}
          </h2>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="mt-2 flex flex-1 flex-col gap-2 overflow-y-auto">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-1">
          <InfoItem label="Code" value={project.code} />
          <InfoItem label="Contract" value={project.contract_number} />
          <InfoItem label="Client" value={project.client_company} />
          <InfoItem label="Users" value={project.user_count?.toString()} />
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-full bg-gray-200" />

        {/* Metrics */}
        <div className="flex flex-col gap-2">
          <h3 className="text-dark-950 text-base font-light">Metrics</h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Clients" value={formatNumber(project.total_clients)} />
            <MetricCard label="Total Debt" value={formatCurrency(project.total_debt_amount)} />
          </div>
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-full bg-gray-200" />

        {/* Description */}
        {project.description && (
          <div className="flex flex-col gap-2">
            <h3 className="text-dark-950 text-sm font-light">Description</h3>
            <p className="text-dark-950 text-sm leading-relaxed font-light">
              {isExpanded ? project.description : truncateText(project.description, 120)}
            </p>
            {project.description.length > 120 && (
              <div className="flex">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-secondary-800 text-xs font-medium"
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="my-1 h-px w-full bg-gray-200" />

        {/* Access and Roles */}
        <div className="flex flex-col gap-2">
          <h3 className="text-dark-950 text-base font-light">Access and Roles</h3>
          <div className="flex items-center justify-start gap-2">
            <span className="text-xs font-light text-gray-600">Assigned users:</span>
            <span className="text-dark-950 text-sm font-medium">
              {project.assigned_users_count || project.statistics?.user_count || 0}
            </span>
          </div>
          <div className="flex items-center justify-start gap-2">
            <span className="text-xs font-light text-gray-600">Default roles:</span>
            <span
              className="text-dark-950 text-right text-xs font-medium"
              title={project.default_roles?.join(', ')}
            >
              {project.default_roles?.join(', ') || 'None'}
            </span>
          </div>
          <div className="flex">
            <button
              onClick={() => navigate('/dashboard/roles')}
              className="bg-secondary-800 mt-3 flex items-center gap-1.5 rounded p-2.5 text-xs font-[500] text-white"
            >
              <Icons.UserCircle02Icon size={20} color="#0CA8EB" />
              Manage users & roles
              <Icons.ArrowRight size={20} color="#0CA8EB" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-full bg-gray-200" />

        {/* Audit */}
        <div className="flex flex-col gap-3">
          <h3 className="text-dark-950 text-base font-light">Audit</h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs font-light text-gray-700">Created by</span>
              <span className="text-dark-950 text-xs font-medium">
                {project.created_by?.username || 'System'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-light text-gray-700">Created</span>
              <span className="text-dark-950 text-xs font-medium">
                {formatDateTime(project.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-light text-gray-700">Last updated</span>
              <span className="text-dark-950 text-xs font-medium">
                {formatDateTime(project.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex gap-3 pt-3">
        <button
          onClick={onEdit}
          className="bg-primary-300 text-dark-950 flex h-[45px] flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium"
        >
          <Icons.PencilEdit size={20} color="#1A1A1A" strokeWidth={2} />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="bg-error-500 flex h-[45px] flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium text-white"
        >
          <Icons.Delete size={20} color="#FFFFFF" strokeWidth={2} />
          Delete
        </button>
      </div>
    </div>
  )
}

// Helper component for info items
function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-light text-gray-700">{label}:</span>
      <span className="text-dark-950 text-base font-medium">{value || '—'}</span>
    </div>
  )
}

// Helper component for metric cards
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-light text-gray-700">{label}:</span>
      <span className="text-dark-950 text-xs font-medium">{value}</span>
    </div>
  )
}

export default ProjectDetailPanel
