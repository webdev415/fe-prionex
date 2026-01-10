/**
 * ProjectDetailModal Component
 *
 * Modal that displays detailed project information.
 * Same content as ProjectDetailPanel, but displayed in a modal for mobile view.
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
import { Modal, ModalHeader, ModalContent, ModalFooter } from '@/components/ui/Modal'

interface ProjectDetailModalProps {
  project: ApiProjectDetail | null
  hasProjects: boolean
  open: boolean
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
  isLoading?: boolean
}

export function ProjectDetailModal({
  project,
  hasProjects,
  open,
  onClose,
  onEdit,
  onDelete,
  isLoading = false,
}: ProjectDetailModalProps) {
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

  const handleEdit = () => {
    onEdit()
    onClose()
  }

  const handleDelete = () => {
    onDelete()
    onClose()
  }

  // Empty state when there are no projects
  if (!hasProjects) {
    return (
      <Modal open={open} onClose={onClose} maxWidth="lg">
        <ModalHeader
          icon={<Icons.View size={24} className="text-gray-300" strokeWidth={1} />}
          title={t('pages.projects.detailPanel.noProject')}
        />
        <ModalContent>
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-sm text-gray-500">{t('pages.projects.detailPanel.noProject')}</p>
          </div>
        </ModalContent>
      </Modal>
    )
  }

  // Loading state
  if (isLoading || !project) {
    return (
      <Modal open={open} onClose={onClose} maxWidth="lg">
        <ModalHeader title={t('pages.projects.title')} />
        <ModalContent>
          <ProjectDetailPanelSkeleton />
        </ModalContent>
      </Modal>
    )
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <ModalHeader
        icon={
          <div className="mx-4 flex h-7 w-7 items-center justify-center sm:h-8 sm:w-8">
            <StatusBadge status={getStatusType(project.status)} />
          </div>
        }
        title={project.name}
      />
      <ModalContent>
        <div className="flex flex-col gap-2">
          {/* Basic Info */}
          <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            <InfoItem label={t('pages.projects.detailPanel.code')} value={project.code} />
            <InfoItem
              label={t('pages.projects.detailPanel.contract')}
              value={project.contract_number}
            />
            <InfoItem
              label={t('pages.projects.detailPanel.client')}
              value={project.client_company}
            />
            <InfoItem
              label={t('pages.projects.detailPanel.users')}
              value={project.user_count?.toString()}
            />
          </div>

          {/* Divider */}
          <div className="my-1 h-px w-full bg-gray-200" />

          {/* Metrics */}
          <div className="flex flex-col gap-2">
            <h3 className="text-dark-500 text-base font-light">
              {t('pages.projects.detailPanel.metrics')}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetricCard
                label={t('pages.projects.detailPanel.clients')}
                value={formatNumber(project.total_clients)}
              />
              <MetricCard
                label={t('pages.projects.detailPanel.totalDebt')}
                value={formatCurrency(project.total_debt_amount)}
              />
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <>
              {/* Divider */}
              <div className="my-1 h-px w-full bg-gray-200" />
              <div className="flex flex-col gap-2">
                <h3 className="text-dark-500 text-sm font-light">
                  {t('pages.projects.detailPanel.description')}
                </h3>
                <p className="text-dark-500 text-sm leading-relaxed font-light">
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
          <div className="my-1 h-px w-full bg-gray-200" />

          {/* Access and Roles */}
          <div className="flex flex-col gap-2">
            <h3 className="text-dark-500 text-base font-light">
              {t('pages.projects.detailPanel.accessAndRoles')}
            </h3>
            <div className="flex items-center justify-start gap-2">
              <span className="text-xs font-light text-gray-600">
                {t('pages.projects.detailPanel.assignedUsers')}
              </span>
              <span className="text-dark-500 text-sm font-medium">
                {project.assigned_users_count || project.statistics?.user_count || 0}
              </span>
            </div>
            <div className="flex items-center justify-start gap-2">
              <span className="text-xs font-light text-gray-600">
                {t('pages.projects.detailPanel.defaultRoles')}
              </span>
              <span
                className="text-dark-500 text-right text-xs font-medium"
                title={project.default_roles?.join(', ')}
              >
                {project.default_roles?.join(', ') || t('pages.projects.detailPanel.none')}
              </span>
            </div>
            <div className="flex">
              <button
                onClick={() => {
                  onClose()
                  navigate('/dashboard/roles')
                }}
                className="bg-secondary-800 mt-3 flex items-center gap-1.5 rounded p-2.5 text-xs font-[500] text-white"
              >
                <Icons.UserCircle02Icon size={20} className="text-primary-400" />
                {t('pages.projects.detailPanel.manageUsersRoles')}
                <Icons.ArrowRight size={20} className="text-primary-400" />
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="my-1 h-px w-full bg-gray-200" />

          {/* Audit */}
          <div className="flex flex-col gap-3">
            <h3 className="text-dark-500 text-base font-light">
              {t('pages.projects.detailPanel.audit')}
            </h3>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-xs font-light text-gray-700">
                  {t('pages.projects.detailPanel.createdBy')}
                </span>
                <span className="text-dark-500 text-xs font-medium">
                  {project.created_by?.username || t('pages.projects.detailPanel.system')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-light text-gray-700">
                  {t('pages.projects.detailPanel.created')}
                </span>
                <span className="text-dark-500 text-xs font-medium">
                  {formatDateTime(project.created_at)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs font-light text-gray-700">
                  {t('pages.projects.detailPanel.lastUpdated')}
                </span>
                <span className="text-dark-500 text-xs font-medium">
                  {formatDateTime(project.updated_at)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </ModalContent>
      <ModalFooter>
        <Button
          variant="primary"
          size="xl"
          onClick={handleEdit}
          className="h-[45px] w-full flex-1 self-stretch rounded-md text-sm sm:flex-initial"
          leftIcon={<Icons.PencilEdit size={20} className="text-dark-500" strokeWidth={2} />}
        >
          {t('pages.projects.detailPanel.edit')}
        </Button>
        <Button
          variant="danger"
          size="xl"
          onClick={handleDelete}
          className="h-[45px] w-full flex-1 self-stretch rounded-md text-sm sm:flex-initial"
          leftIcon={<Icons.Delete size={20} className="text-white" strokeWidth={2} />}
        >
          {t('pages.projects.detailPanel.delete')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

// Helper component for info items
function InfoItem({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="text-xs font-light text-gray-700">{label}:</span>
      <span className="text-dark-500 text-base font-medium break-words">{value || '—'}</span>
    </div>
  )
}

// Helper component for metric cards
function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-light text-gray-700">{label}:</span>
      <span className="text-dark-500 text-xs font-medium">{value}</span>
    </div>
  )
}

export default ProjectDetailModal
