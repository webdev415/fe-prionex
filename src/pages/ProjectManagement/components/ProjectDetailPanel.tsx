/**
 * ProjectDetailPanel Component
 *
 * Inline panel that displays detailed project information.
 * Sits in the 30% width area next to the DataTable.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icons } from '@/lib/icons'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency, formatNumber, formatDateTime, truncateText } from '@/lib/formatters'
import type { ApiProjectDetail } from '@/features/projects/types'
import { ProjectDetailPanelSkeleton } from './ProjectDetailPanelSkeleton'
import { Button } from '@/components/ui/Button'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'

interface ProjectDetailPanelProps {
  project: ApiProjectDetail | null
  hasProjects: boolean
  onEdit: () => void
  isLoading?: boolean
}

export function ProjectDetailPanel({
  project,
  hasProjects,
  onEdit,
  isLoading = false,
}: ProjectDetailPanelProps) {
  const { t } = useTranslation('common')
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
      <div className="border-border bg-card/50 flex h-full flex-col items-center justify-center rounded-lg border p-6">
        <Icons.View size={48} className="text-muted-foreground" strokeWidth={1} />
        <p className="text-muted-foreground mt-4 text-sm">
          {t('pages.projects.detailPanel.noProject')}
        </p>
      </div>
    )
  }

  // Loading state
  if (isLoading || !project) {
    return <ProjectDetailPanelSkeleton />
  }

  return (
    <div className="border-border bg-card/50 flex h-full w-full flex-col overflow-hidden rounded-lg border p-6">
      {/* Header */}
      <div className="flex items-center border-none">
        <div className="flex items-center gap-2">
          <StatusBadge status={getStatusType(project.status)} />
          <h2
            className="text-foreground max-w-[180px] truncate text-base font-medium"
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
          <InfoItem label={t('pages.projects.detailPanel.code')} value={project.code} />
          <InfoItem
            label={t('pages.projects.detailPanel.contract')}
            value={project.contract_number}
          />
          <InfoItem label={t('pages.projects.detailPanel.client')} value={project.client_company} />
          <InfoItem
            label={t('pages.projects.detailPanel.users')}
            value={project.user_count?.toString()}
          />
        </div>

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Metrics */}
        <div className="flex flex-col gap-2">
          <h3 className="text-foreground text-base font-light">
            {t('pages.projects.detailPanel.metrics')}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label={t('pages.projects.detailPanel.clients')}
              value={formatNumber(project.total_clients)}
            />
            <MetricCard
              label={t('pages.projects.detailPanel.totalDebt')}
              value={formatCurrency(project.total_debt_amount, project.currency)}
            />
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <>
            {/* Divider */}
            <div className="bg-border my-1 h-px w-full" />
            <div className="flex flex-col gap-2">
              <h3 className="text-foreground text-sm font-light">
                {t('pages.projects.detailPanel.description')}
              </h3>
              <p className="text-foreground text-sm leading-relaxed font-light">
                {isExpanded ? project.description : truncateText(project.description, 120)}
              </p>
              {project.description.length > 120 && (
                <div className="flex">
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-secondary-800 text-xs font-medium"
                  >
                    {isExpanded
                      ? t('pages.projects.detailPanel.showLess')
                      : t('pages.projects.detailPanel.readMore')}
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Access and Roles */}
        <div className="flex flex-col gap-2">
          <h3 className="text-foreground text-base font-light">
            {t('pages.projects.detailPanel.accessAndRoles')}
          </h3>
          <div className="flex items-center justify-start gap-2">
            <span className="text-muted-foreground text-xs font-light">
              {t('pages.projects.detailPanel.assignedUsers')}
            </span>
            <span className="text-foreground text-sm font-medium">
              {project.assigned_users_count || project.statistics?.user_count || 0}
            </span>
          </div>
          <div className="flex items-center justify-start gap-2">
            <span className="text-muted-foreground text-xs font-light">
              {t('pages.projects.detailPanel.defaultRoles')}
            </span>
            <span
              className="text-foreground text-right text-xs font-medium"
              title={project.default_roles?.join(', ')}
            >
              {project.default_roles?.join(', ') || t('pages.projects.detailPanel.none')}
            </span>
          </div>
          <div className="flex">
            <button
              onClick={() => navigate('/dashboard/team-management/roles')}
              className="bg-secondary-800 mt-3 flex items-center gap-1.5 rounded p-2.5 text-xs font-[500] text-white"
            >
              <Icons.UserCircle02Icon size={20} className="text-primary-400" />
              {t('pages.projects.detailPanel.manageUsersRoles')}
              <Icons.ArrowRight size={20} className="text-primary-400" />
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="bg-border my-1 h-px w-full" />

        {/* Audit */}
        <div className="flex flex-col gap-3">
          <h3 className="text-foreground text-base font-light">
            {t('pages.projects.detailPanel.audit')}
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs font-light">
                {t('pages.projects.detailPanel.createdBy')}
              </span>
              <span className="text-foreground text-xs font-medium">
                {project.created_by?.username || t('pages.projects.detailPanel.system')}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs font-light">
                {t('pages.projects.detailPanel.created')}
              </span>
              <span className="text-foreground text-xs font-medium">
                {formatDateTime(project.created_at)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground text-xs font-light">
                {t('pages.projects.detailPanel.lastUpdated')}
              </span>
              <span className="text-foreground text-xs font-medium">
                {formatDateTime(project.updated_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <PermissionGuard permission={PERMISSIONS.PROJECTS.MANAGE}>
        <div className="flex gap-3 pt-3">
          <Button
            variant="primary"
            size="xl"
            onClick={onEdit}
            className="h-[45px] flex-1 rounded-md text-sm"
            leftIcon={<Icons.PencilEdit size={20} className="text-foreground" strokeWidth={2} />}
          >
            {t('pages.projects.detailPanel.edit')}
          </Button>
        </div>
      </PermissionGuard>
    </div>
  )
}

// Helper component for info items
function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs font-light">{label}:</span>
      <span className="text-foreground text-base font-medium">{value || '—'}</span>
    </div>
  )
}

// Helper component for metric cards
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs font-light">{label}:</span>
      <span className="text-foreground text-xs font-medium">{value}</span>
    </div>
  )
}

export default ProjectDetailPanel
