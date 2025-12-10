/**
 * ProjectDetailPanel Component
 *
 * Inline panel that displays detailed project information.
 * Sits in the 30% width area next to the DataTable.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icons } from '@/lib/icons'
import { colors } from '@/lib/colors'
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
      <div
        className="flex h-full flex-col items-center justify-center rounded-lg p-6"
        style={{
          backgroundColor: '#FFFFFF80',
          border: `1px solid ${colors.gray[200]}`,
        }}
      >
        <Icons.View size={48} color={colors.gray[300]} strokeWidth={1} />
        <p className="mt-4 text-sm" style={{ color: colors.gray[500] }}>
          There is no project
        </p>
      </div>
    )
  }

  // Loading state
  if (isLoading || !project) {
    return (
      <div
        className="flex h-full items-center justify-center rounded-lg"
        style={{
          backgroundColor: '#FFFFFF',
          border: `1px solid ${colors.gray[200]}`,
        }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-b-2"
          style={{ borderColor: colors.primary[500] }}
        />
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-lg p-6"
      style={{
        backgroundColor: '#FFFFFF80',
        border: `1px solid ${colors.gray[200]}`,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center border-none"
      >
        <div className="flex items-center gap-2">
          <StatusBadge status={getStatusType(project.status)} />
          <h2
            className="max-w-[180px] truncate text-base font-medium"
            style={{ color: colors.neutral.dark[500] }}
            title={project.name}
          >
            {project.name}
          </h2>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="mt-2 flex-1 overflow-y-auto flex flex-col gap-2">
        {/* Basic Info */}
        <div className="grid grid-cols-2 gap-1">
            <InfoItem label="Code" value={project.code} />
            <InfoItem label="Contract" value={project.contract_number} />
            <InfoItem label="Client" value={project.client_company} />
            <InfoItem label="Users" value={project.user_count?.toString()} />
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-full" style={{ backgroundColor: colors.gray[200] }} />

        {/* Metrics */}
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-light" style={{ color: colors.neutral.dark[500] }}>
            Metrics
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard label="Clients" value={formatNumber(project.total_clients)} />
            <MetricCard
              label="Total Debt"
              value={formatCurrency(project.total_debt_amount)}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-full" style={{ backgroundColor: colors.gray[200] }} />

        {/* Description */}
        {project.description && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-light" style={{ color: colors.neutral.dark[500] }}>
              Description
            </h3>
            <p className="text-sm font-light leading-relaxed" style={{ color: colors.neutral.dark[500] }}>
              {isExpanded ? project.description : truncateText(project.description, 120)}
            </p>
            {project.description.length > 120 && (
              <div className='flex'>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-xs font-medium"
                  style={{ color: colors.secondary[800]}}
                >
                  {isExpanded ? 'Show less' : 'Read more'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="my-1 h-px w-full" style={{ backgroundColor: colors.gray[200] }} />

        {/* Access and Roles */}
        <div className='flex flex-col gap-2'>
          <h3 className="text-base font-light" style={{ color: colors.neutral.dark[500] }}>
            Access and Roles
          </h3>
          <div className="flex items-center justify-start gap-2">
            <span className="text-xs font-light" style={{ color: colors.gray[600] }}>
              Assigned users:
            </span>
            <span className="text-sm font-medium" style={{ color: colors.neutral.dark[500] }}>
              {project.assigned_users_count || project.statistics?.user_count || 0}
            </span>
          </div>
          <div className="flex items-center justify-start gap-2">
            <span className="text-xs font-light" style={{ color: colors.gray[600] }}>
              Default roles:
            </span>
            <span
              className="text-right text-xs font-medium"
              style={{ color: colors.neutral.dark[500] }}
              title={project.default_roles?.join(', ')}
            >
              {project.default_roles?.join(', ') || 'None'}
            </span>
          </div>
          <div className='flex'>
            <button
              onClick={() => navigate('/dashboard/roles')}
              className="mt-3 flex items-center gap-1.5 text-xs font-[500] text-white p-2.5 rounded"
              style={{ backgroundColor: colors.secondary[800] }}
            >
              <Icons.UserCircle02Icon size={20} color={colors.primary[500]} />
              Manage users & roles
              <Icons.ArrowRight size={20} color={colors.primary[500]} />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="my-1 h-px w-full" style={{ backgroundColor: colors.gray[200] }} />

        {/* Audit */}
        <div className="flex flex-col gap-3">
          <h3 className="text-base font-light" style={{ color: colors.neutral.dark[500] }}>
            Audit
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs font-light" style={{ color: colors.gray[700] }}>
                Created by
              </span>
              <span className="text-xs font-medium" style={{ color: colors.neutral.dark[500] }}>
                {project.created_by?.username || 'System'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-light" style={{ color: colors.gray[700] }}>
                Created
              </span>
              <span className="text-xs font-medium" style={{ color: colors.neutral.dark[500] }}>
                {formatDateTime(project.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs font-light" style={{ color: colors.gray[700] }}>
                Last updated
              </span>
              <span className="text-xs font-medium" style={{ color: colors.neutral.dark[500] }}>
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
          className="flex flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: colors.primary[300],
            color: colors.neutral.dark[500],
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <Icons.PencilEdit size={20} color={colors.neutral.dark[500]} strokeWidth={2} />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex flex-1 items-center justify-center gap-2 rounded-md text-sm font-medium"
          style={{
            border: 'none',
            backgroundColor: '#EF4444',
            color: '#FFFFFF',
            height: '45px',
            fontSize: '14px',
            fontWeight: 500,
          }}
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
      <span className="text-xs font-light" style={{ color: colors.gray[700] }}>
        {label}:
      </span>
      <span className="text-base font-medium" style={{ color: colors.neutral.dark[500]  }}>
        {value || '—'}
      </span>
    </div>
  )
}

// Helper component for metric cards
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-light" style={{ color: colors.gray[700] }}>
        {label}:
      </span>
      <span className="text-xs font-medium" style={{ color: colors.neutral.dark[500] }}>
        {value}
      </span>
    </div>
  )
}

export default ProjectDetailPanel
