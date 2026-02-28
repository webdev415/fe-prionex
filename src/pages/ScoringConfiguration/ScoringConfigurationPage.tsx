/**
 * Scoring Configuration Page
 *
 * Page for configuring client scoring weights and priority classification thresholds.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Slider } from '@/components/ui/Slider'
import { PriorityBadge } from '@/pages/ClientManagement/components/PriorityBadge'
import { Icons } from '@/lib/icons'
import { cn } from '@/lib/utils'
import {
  configApi,
  type ScoringConfigResponse,
  type PreviewResponse,
} from '@/features/clients/api/configApi'
import { PermissionGuard } from '@/components/auth'
import { PERMISSIONS } from '@/constants/permissions'
import { useHasPermission } from '@/hooks'
import { ScoringConfigurationPageSkeleton } from './ScoringConfigurationPageSkeleton'

interface ScoreWeights {
  debtAmount: number
  daysOverdue: number
  contactHistory: number
}

interface PriorityThresholds {
  critical: number
  high: number
  medium: number
  low: number
}

interface Distribution {
  critical: number
  high: number
  medium: number
  low: number
}

export function ScoringConfigurationPage() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canEditScoring = useHasPermission(PERMISSIONS.SCORING_CONFIG.EDIT)

  // Get active project name
  const activeProject = useMemo(() => {
    if (!user?.projects || !user?.active_project_id) return null
    return user.projects.find((p) => p.id === user.active_project_id)
  }, [user])

  const projectName =
    activeProject?.name || t('pages.scoringConfiguration.defaultProject', 'Project')

  // Tab state
  const [activeTab, setActiveTab] = useState<'weights' | 'thresholds'>('weights')

  // Loading and error states
  const [isLoading, setIsLoading] = useState(true)
  const [isSavingWeights, setIsSavingWeights] = useState(false)
  const [isSavingThresholds, setIsSavingThresholds] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [originalConfig, setOriginalConfig] = useState<ScoringConfigResponse | null>(null)
  const [previewData, setPreviewData] = useState<PreviewResponse | null>(null)

  // Score weights state
  const [scoreWeights, setScoreWeights] = useState<ScoreWeights>({
    debtAmount: 40,
    daysOverdue: 40,
    contactHistory: 20,
  })

  // Priority thresholds state
  const [priorityThresholds, setPriorityThresholds] = useState<PriorityThresholds>({
    critical: 25,
    high: 18,
    medium: 10,
    low: 0,
  })

  // Immediate effect checkbox
  const [immediateEffect, setImmediateEffect] = useState(true)

  // Change reason state
  const [weightChangeReason, setWeightChangeReason] = useState('')
  const [thresholdChangeReason, setThresholdChangeReason] = useState('')

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadConfiguration = async () => {
    try {
      setIsLoading(true)
      const projectId = user?.active_project_id ? Number(user.active_project_id) : null
      const config = await configApi.getScoringConfig(projectId, null)

      // Convert API response to component state
      setScoreWeights({
        debtAmount: config.weights.debt_amount * 100,
        daysOverdue: config.weights.days_overdue * 100,
        contactHistory: config.weights.contact_history * 100,
      })

      setPriorityThresholds(config.priority_thresholds)
      setOriginalConfig(config)

      // Show fallback warning if applicable
      if (config.source === 'fallback') {
        toast.warning(
          t(
            'pages.scoringConfiguration.fallbackWarning',
            'Using fallback configuration. Database connection unavailable.'
          )
        )
      }
    } catch (error) {
      console.error('Failed to load configuration:', error)
      toast.error(
        t('pages.scoringConfiguration.loadError', 'Failed to load configuration. Using defaults.')
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Current distribution from preview
  const currentDistribution: Distribution | null = useMemo(() => {
    if (previewData) {
      return {
        critical: previewData.current_distribution.critical.count,
        high: previewData.current_distribution.high.count,
        medium: previewData.current_distribution.medium.count,
        low: previewData.current_distribution.low.count,
      }
    }
    return null
  }, [previewData])

  // New distribution from preview
  const newDistribution: Distribution | null = useMemo(() => {
    if (previewData) {
      return {
        critical: previewData.new_distribution.critical.count,
        high: previewData.new_distribution.high.count,
        medium: previewData.new_distribution.medium.count,
        low: previewData.new_distribution.low.count,
      }
    }
    return null
  }, [previewData])

  const totalClients = useMemo(() => {
    if (!currentDistribution) return 0
    return (
      currentDistribution.critical +
      currentDistribution.high +
      currentDistribution.medium +
      currentDistribution.low
    )
  }, [currentDistribution])

  const totalWeight = useMemo(() => {
    return scoreWeights.debtAmount + scoreWeights.daysOverdue + scoreWeights.contactHistory
  }, [scoreWeights])

  const handleWeightChange = (field: keyof ScoreWeights, value: number) => {
    setScoreWeights((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleThresholdChange = (field: keyof PriorityThresholds, value: number) => {
    setPriorityThresholds((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleResetDefaults = () => {
    // Reset to original config values from API, not hardcoded defaults
    if (originalConfig) {
      setPriorityThresholds(originalConfig.priority_thresholds)
    } else {
      // Fallback to defaults only if original config not loaded yet
      setPriorityThresholds({
        critical: 25,
        high: 18,
        medium: 10,
        low: 0,
      })
    }
    setPreviewData(null) // Clear preview data
  }

  const handlePreview = async () => {
    try {
      setIsPreviewing(true)
      const projectId = user?.active_project_id ? Number(user.active_project_id) : null
      const preview = await configApi.previewScoringConfig({
        project_id: projectId,
        seller_id: null,
        new_priority_thresholds: priorityThresholds,
      })
      setPreviewData(preview)
      toast.success(t('pages.scoringConfiguration.previewSuccess', 'Preview updated'))
    } catch (error) {
      console.error('Failed to preview configuration:', error)
      toast.error(t('pages.scoringConfiguration.previewError', 'Failed to preview changes'))
    } finally {
      setIsPreviewing(false)
    }
  }

  const handleSaveWeights = async () => {
    // Validate total weight
    if (totalWeight !== 100) {
      toast.error(t('pages.scoringConfiguration.weightError', 'Total weights must equal 100%'))
      return
    }

    try {
      setIsSavingWeights(true)

      // Convert percentages to decimals for API
      const projectId = user?.active_project_id ? Number(user.active_project_id) : null
      await configApi.updateScoringConfig({
        project_id: projectId,
        seller_id: null,
        weights: {
          debt_amount: scoreWeights.debtAmount / 100,
          days_overdue: scoreWeights.daysOverdue / 100,
          contact_history: scoreWeights.contactHistory / 100,
        },
        immediate_effect: immediateEffect,
        change_reason: weightChangeReason.trim() || 'Score weights updated via web interface',
      })

      // Clear reason after successful save
      setWeightChangeReason('')

      toast.success(
        t('pages.scoringConfiguration.weightsSaveSuccess', 'Score weights saved successfully')
      )

      // Invalidate history query so it refreshes when navigating to history page
      queryClient.invalidateQueries({ queryKey: ['configHistory'] })

      // Invalidate client queries to refresh priorities and priority summary
      queryClient.invalidateQueries({ queryKey: ['clients'] })

      // Invalidate config queries to refresh thresholds used in priority mapping
      queryClient.invalidateQueries({ queryKey: ['config'] })

      // Reload configuration to get updated data
      await loadConfiguration()
    } catch (error) {
      console.error('Failed to save weights:', error)
      const errorMessage =
        (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        t('pages.scoringConfiguration.weightsSaveError', 'Failed to save score weights')
      toast.error(errorMessage)
    } finally {
      setIsSavingWeights(false)
    }
  }

  const handleSaveThresholds = async () => {
    try {
      setIsSavingThresholds(true)

      const projectId = user?.active_project_id ? Number(user.active_project_id) : null
      await configApi.updateScoringConfig({
        project_id: projectId,
        seller_id: null,
        priority_thresholds: priorityThresholds,
        immediate_effect: immediateEffect,
        change_reason:
          thresholdChangeReason.trim() || 'Priority thresholds updated via web interface',
      })

      // Clear reason after successful save
      setThresholdChangeReason('')

      toast.success(
        t(
          'pages.scoringConfiguration.thresholdsSaveSuccess',
          'Priority thresholds saved successfully'
        )
      )

      // Invalidate history query so it refreshes when navigating to history page
      queryClient.invalidateQueries({ queryKey: ['configHistory'] })

      // Invalidate client queries to refresh priorities and priority summary
      queryClient.invalidateQueries({ queryKey: ['clients'] })

      // Invalidate config queries to refresh thresholds used in priority mapping
      queryClient.invalidateQueries({ queryKey: ['config'] })

      // Reload configuration to get updated data
      await loadConfiguration()
      setPreviewData(null) // Clear preview
    } catch (error) {
      console.error('Failed to save thresholds:', error)
      const errorMessage =
        (error as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
        t('pages.scoringConfiguration.thresholdsSaveError', 'Failed to save priority thresholds')
      toast.error(errorMessage)
    } finally {
      setIsSavingThresholds(false)
    }
  }

  const handleViewHistory = () => {
    navigate('/dashboard/scoring-configuration/history')
  }

  const formatPercentage = (count: number, total: number) => {
    if (!Number.isFinite(total) || total <= 0) return 0
    if (!Number.isFinite(count) || count <= 0) return 0
    return Math.round((count / total) * 100)
  }

  // Show loading state
  if (isLoading) {
    return <ScoringConfigurationPageSkeleton />
  }

  return (
    <div className="flex w-full flex-col items-start gap-4">
      {/* Header */}
      <div className="mb-4 flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-dark-500 text-xl font-light sm:text-2xl">
          {t('pages.scoringConfiguration.title', 'Scoring Configuration')} -{' '}
          <span className="font-semibold">{projectName}</span>
        </h1>
        <Button
          variant="primary"
          onClick={handleViewHistory}
          leftIcon={<Icons.TransactionHistory size={20} className="text-dark-500" />}
          className="flex h-12 w-full flex-row items-center justify-center rounded-full text-xs leading-[150%] font-medium sm:w-auto"
        >
          {t('pages.scoringConfiguration.viewHistory', 'View History')}
        </Button>
      </div>

      {/* Mobile Tabs (Top Navigation) */}
      <div className="flex w-full gap-2 lg:hidden">
        <button
          onClick={() => setActiveTab('weights')}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors duration-200',
            activeTab === 'weights'
              ? 'bg-secondary-800 text-white shadow-sm'
              : 'text-dark-500 bg-white hover:bg-gray-50'
          )}
        >
          {t('pages.scoringConfiguration.scoreWeights', 'Score Weights')}
        </button>
        <button
          onClick={() => setActiveTab('thresholds')}
          className={cn(
            'flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-3 text-center text-sm font-semibold transition-colors duration-200',
            activeTab === 'thresholds'
              ? 'bg-secondary-800 text-white shadow-sm'
              : 'text-dark-500 bg-white hover:bg-gray-50'
          )}
        >
          {t('pages.scoringConfiguration.priorityThresholds', 'Priority Thresholds')}
        </button>
      </div>

      {/* Side Tabs Layout */}
      <div className="flex w-full flex-col gap-6 lg:flex-row">
        {/* Side Tabs - Hidden on mobile, shown on desktop */}
        <div className="hidden w-[200px] flex-shrink-0 flex-col gap-1 lg:flex">
          <button
            onClick={() => setActiveTab('weights')}
            className={cn(
              'flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors duration-200',
              activeTab === 'weights'
                ? 'bg-secondary-800 text-white shadow-sm'
                : 'text-dark-500 bg-white hover:bg-gray-50'
            )}
          >
            {t('pages.scoringConfiguration.scoreWeights', 'Score Weights')}
          </button>
          <button
            onClick={() => setActiveTab('thresholds')}
            className={cn(
              'flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg px-4 py-3 text-left text-sm font-semibold transition-colors duration-200',
              activeTab === 'thresholds'
                ? 'bg-secondary-800 text-white shadow-sm'
                : 'text-dark-500 bg-white hover:bg-gray-50'
            )}
          >
            {t('pages.scoringConfiguration.priorityThresholds', 'Priority Thresholds')}
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex flex-1 flex-col gap-4">
          {/* Score Weights Tab */}
          {activeTab === 'weights' && (
            <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-4 sm:p-6">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h2 className="text-dark-500 mb-1 text-base font-semibold sm:text-lg">
                    {t('pages.scoringConfiguration.scoreWeights', 'Score Weights')}
                  </h2>
                  <p className="text-dark-400 text-sm font-light">
                    {t(
                      'pages.scoringConfiguration.scoreWeightsDescription',
                      'Configure the relative importance of each factor in calculating client scores. Total must equal 100%.'
                    )}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="flex flex-col gap-4">
                  {/* Debt Amount Weight */}
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-3">
                      <span className="text-dark-500 text-sm font-medium">
                        {t('pages.scoringConfiguration.debtAmountWeight', 'Debt Amount Weight')}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[300px] md:min-w-[400px] lg:min-w-[500px]">
                      <Slider
                        value={scoreWeights.debtAmount}
                        onValueChange={(value) => handleWeightChange('debtAmount', value)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        disabled={!canEditScoring}
                      />
                    </div>
                  </div>

                  {/* Days Overdue Weight */}
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-3">
                      <span className="text-dark-500 text-sm font-medium">
                        {t('pages.scoringConfiguration.daysOverdueWeight', 'Days Overdue Weight')}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[300px] md:min-w-[400px] lg:min-w-[500px]">
                      <Slider
                        value={scoreWeights.daysOverdue}
                        onValueChange={(value) => handleWeightChange('daysOverdue', value)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        disabled={!canEditScoring}
                      />
                    </div>
                  </div>

                  {/* Contact History Weight */}
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                    <div className="flex flex-1 items-center gap-3">
                      <span className="text-dark-500 text-sm font-medium">
                        {t(
                          'pages.scoringConfiguration.contactHistoryWeight',
                          'Contact History Weight'
                        )}
                      </span>
                    </div>
                    <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[300px] md:min-w-[400px] lg:min-w-[500px]">
                      <Slider
                        value={scoreWeights.contactHistory}
                        onValueChange={(value) => handleWeightChange('contactHistory', value)}
                        min={0}
                        max={100}
                        step={1}
                        className="w-full"
                        disabled={!canEditScoring}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end">
                <span
                  className={`inline-flex h-[33px] items-center gap-1.5 rounded-full px-3 text-xs font-medium ${
                    totalWeight === 100 ? 'bg-success-500 text-white' : 'bg-error-500 text-white'
                  }`}
                >
                  {totalWeight === 100 && <span className="h-2 w-2 rounded-full bg-white" />}
                  {t('pages.scoringConfiguration.current', 'Current')}: {totalWeight}%
                </span>
              </div>

              {/* Change Reason Input */}
              <div className="flex flex-col gap-2">
                <label className="text-dark-500 text-sm font-medium">
                  {t('pages.scoringConfiguration.changeReason', 'Change Reason')}
                  <span className="text-xs font-normal text-gray-500">
                    {' '}
                    ({t('pages.scoringConfiguration.optional', 'Optional')})
                  </span>
                </label>
                <Input
                  type="text"
                  value={weightChangeReason}
                  onChange={(e) => setWeightChangeReason(e.target.value)}
                  placeholder={t(
                    'pages.scoringConfiguration.changeReasonPlaceholder',
                    'Enter reason for this change (optional)'
                  )}
                  className="w-full"
                />
              </div>

              {/* Save Button for Weights */}
              <div className="flex items-center justify-end">
                <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.EDIT}>
                  <Button
                    variant="primary"
                    onClick={handleSaveWeights}
                    disabled={isSavingWeights || totalWeight !== 100}
                    className="rounded-md"
                  >
                    {isSavingWeights
                      ? t('pages.scoringConfiguration.saving', 'Saving...')
                      : t('pages.scoringConfiguration.saveWeights', 'Save Weights')}
                  </Button>
                </PermissionGuard>
              </div>
            </div>
          )}

          {/* Priority Thresholds Tab */}
          {activeTab === 'thresholds' && (
            <div className="flex w-full flex-col gap-4">
              <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-4 sm:p-6">
                <div className="mb-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-dark-500 mb-1 text-base font-semibold sm:text-lg">
                      {t(
                        'pages.scoringConfiguration.priorityThresholds',
                        'Priority Classification Thresholds'
                      )}
                    </h2>
                    <p className="text-dark-400 text-sm font-light">
                      {t(
                        'pages.scoringConfiguration.thresholdsDescription',
                        'Set the minimum score values for each priority level. Clients are classified based on their calculated scores.'
                      )}
                    </p>
                  </div>
                  <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.EDIT}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleResetDefaults}
                      className="w-full rounded-md sm:w-auto"
                    >
                      {t('pages.scoringConfiguration.resetDefaults', 'Reset Defaults')}
                    </Button>
                  </PermissionGuard>
                </div>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    {/* Critical Priority */}
                    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                      <PriorityBadge priority="Critical" variant="compact" />
                      <div className="flex flex-1 items-center gap-3">
                        <span className="text-dark-500 text-sm font-medium">
                          {t('pages.scoringConfiguration.scoreGreaterThanOrEqual', 'Score ≥')}
                        </span>
                        <div>
                          <Input
                            type="number"
                            value={priorityThresholds.critical}
                            onChange={(e) =>
                              handleThresholdChange('critical', Number(e.target.value) || 0)
                            }
                            className="w-20 rounded-md"
                            inputSize="sm"
                            disabled={!canEditScoring}
                          />
                        </div>
                      </div>
                    </div>

                    {/* High Priority */}
                    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                      <PriorityBadge priority="High" variant="compact" />
                      <div className="flex flex-1 items-center gap-3">
                        <span className="text-dark-500 text-sm font-medium">
                          {t('pages.scoringConfiguration.scoreGreaterThanOrEqual', 'Score ≥')}
                        </span>
                        <div>
                          <Input
                            type="number"
                            value={priorityThresholds.high}
                            onChange={(e) =>
                              handleThresholdChange('high', Number(e.target.value) || 0)
                            }
                            className="w-20 rounded-md"
                            inputSize="sm"
                            disabled={!canEditScoring}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    {/* Medium Priority */}
                    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                      <PriorityBadge priority="Medium" variant="compact" />
                      <div className="flex flex-1 items-center gap-3">
                        <span className="text-dark-500 text-sm font-medium">
                          {t('pages.scoringConfiguration.scoreGreaterThanOrEqual', 'Score ≥')}
                        </span>
                        <div>
                          <Input
                            type="number"
                            value={priorityThresholds.medium}
                            onChange={(e) =>
                              handleThresholdChange('medium', Number(e.target.value) || 0)
                            }
                            className="w-20 rounded-md"
                            inputSize="sm"
                            disabled={!canEditScoring}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Low Priority */}
                    <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:flex-row sm:items-center">
                      <PriorityBadge priority="Low" variant="compact" />
                      <div className="flex flex-1 items-center gap-3">
                        <span className="text-dark-500 text-sm font-medium">
                          {t('pages.scoringConfiguration.scoreLessThan', 'Score <')}{' '}
                          {priorityThresholds.medium}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <Checkbox
                    id="immediate-effect"
                    checked={immediateEffect}
                    onCheckedChange={(checked) =>
                      setImmediateEffect(checked === true ? true : false)
                    }
                  />
                  <label
                    htmlFor="immediate-effect"
                    className="text-dark-500 cursor-pointer text-sm font-light"
                  >
                    {t(
                      'pages.scoringConfiguration.immediateEffect',
                      'Changes will affect all clients in this project immediately'
                    )}
                  </label>
                </div>

                {/* Change Reason Input */}
                <div className="flex flex-col gap-2">
                  <label className="text-dark-500 text-sm font-medium">
                    {t('pages.scoringConfiguration.changeReason', 'Change Reason')}
                    <span className="text-xs font-normal text-gray-500">
                      {' '}
                      ({t('pages.scoringConfiguration.optional', 'Optional')})
                    </span>
                  </label>
                  <Input
                    type="text"
                    value={thresholdChangeReason}
                    onChange={(e) => setThresholdChangeReason(e.target.value)}
                    placeholder={t(
                      'pages.scoringConfiguration.changeReasonPlaceholder',
                      'Enter reason for this change (optional)'
                    )}
                    className="w-full"
                  />
                </div>

                {/* Save Button for Thresholds */}
                <div className="flex items-center justify-end">
                  <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.EDIT}>
                    <Button
                      variant="primary"
                      onClick={handleSaveThresholds}
                      disabled={isSavingThresholds}
                      className="rounded-md"
                    >
                      {isSavingThresholds
                        ? t('pages.scoringConfiguration.saving', 'Saving...')
                        : t('pages.scoringConfiguration.saveThresholds', 'Save Thresholds')}
                    </Button>
                  </PermissionGuard>
                </div>
              </div>

              {/* Configuration Preview Section */}
              <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-4 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-dark-500 mb-1 text-base font-semibold sm:text-lg">
                      {t(
                        'pages.scoringConfiguration.configurationPreview',
                        'Configuration Preview'
                      )}
                    </h2>
                    <p className="text-dark-400 text-sm font-light">
                      {t(
                        'pages.scoringConfiguration.previewDescription',
                        'See how threshold changes will affect client priority distribution'
                      )}
                    </p>
                  </div>
                  <PermissionGuard permission={PERMISSIONS.SCORING_CONFIG.EDIT}>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handlePreview}
                      disabled={isPreviewing}
                      className="w-full rounded-md sm:w-auto"
                    >
                      {isPreviewing
                        ? t('pages.scoringConfiguration.previewing', 'Previewing...')
                        : t('pages.scoringConfiguration.previewChanges', 'Preview Changes')}
                    </Button>
                  </PermissionGuard>
                </div>

                {/* Preview Content */}
                {!previewData ? (
                  <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8">
                    <Icons.Info size={48} className="text-gray-400" strokeWidth={1.5} />
                    <p className="text-dark-400 text-center text-sm font-light">
                      {t(
                        'pages.scoringConfiguration.previewEmpty',
                        'Click "Preview Changes" to see how threshold changes will affect client priority distribution'
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6">
                    {/* Threshold Details */}
                    <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <h3 className="text-dark-500 text-sm font-semibold">
                        {t('pages.scoringConfiguration.thresholdDetails', 'Threshold Details:')}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
                        <div>
                          <span className="text-dark-400 font-medium">
                            {t('pages.scoringConfiguration.current', 'Current')}:
                          </span>
                          <span className="text-dark-600 ml-2">
                            Critical ≥ {originalConfig?.priority_thresholds.critical || 0}, High ≥{' '}
                            {originalConfig?.priority_thresholds.high || 0}, Medium ≥{' '}
                            {originalConfig?.priority_thresholds.medium || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-dark-400 font-medium">
                            {t('pages.scoringConfiguration.new', 'New')}:
                          </span>
                          <span className="text-dark-600 ml-2">
                            Critical ≥ {priorityThresholds.critical}, High ≥{' '}
                            {priorityThresholds.high}, Medium ≥ {priorityThresholds.medium}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Distribution Comparison */}
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                      {/* Current Distribution */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-dark-500 text-sm font-semibold">
                          {t(
                            'pages.scoringConfiguration.currentDistribution',
                            'Current Distribution:'
                          )}
                        </h3>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="Critical" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {currentDistribution?.critical || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {currentDistribution
                                ? formatPercentage(currentDistribution.critical, totalClients)
                                : 0}
                              %)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="High" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {currentDistribution?.high || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {currentDistribution
                                ? formatPercentage(currentDistribution.high, totalClients)
                                : 0}
                              %)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="Medium" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {currentDistribution?.medium || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {currentDistribution
                                ? formatPercentage(currentDistribution.medium, totalClients)
                                : 0}
                              %)
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="Low" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {currentDistribution?.low || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {currentDistribution
                                ? formatPercentage(currentDistribution.low, totalClients)
                                : 0}
                              %)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* New Distribution */}
                      <div className="flex flex-col gap-3">
                        <h3 className="text-dark-500 text-sm font-semibold">
                          {t(
                            'pages.scoringConfiguration.withNewThresholds',
                            'With New Thresholds:'
                          )}
                        </h3>
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="Critical" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {newDistribution?.critical || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {newDistribution
                                ? formatPercentage(newDistribution.critical, totalClients)
                                : 0}
                              %)
                            </span>
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.critical > currentDistribution.critical && (
                                <Icons.ArrowUp02 size={16} className="text-success-500" />
                              )}
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.critical < currentDistribution.critical && (
                                <Icons.ArrowDown02 size={16} className="text-error-500" />
                              )}
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="High" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {newDistribution?.high || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {newDistribution
                                ? formatPercentage(newDistribution.high, totalClients)
                                : 0}
                              %)
                            </span>
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.high > currentDistribution.high && (
                                <Icons.ArrowUp02 size={16} className="text-success-500" />
                              )}
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.high < currentDistribution.high && (
                                <Icons.ArrowDown02 size={16} className="text-error-500" />
                              )}
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="Medium" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {newDistribution?.medium || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {newDistribution
                                ? formatPercentage(newDistribution.medium, totalClients)
                                : 0}
                              %)
                            </span>
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.medium > currentDistribution.medium && (
                                <Icons.ArrowUp02 size={16} className="text-success-500" />
                              )}
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.medium < currentDistribution.medium && (
                                <Icons.ArrowDown02 size={16} className="text-error-500" />
                              )}
                          </div>
                          <div className="flex items-center gap-3">
                            <PriorityBadge priority="Low" variant="compact" />
                            <span className="text-dark-500 text-sm">
                              {newDistribution?.low || 0}{' '}
                              {t('pages.scoringConfiguration.clients', 'clients')} (
                              {newDistribution
                                ? formatPercentage(newDistribution.low, totalClients)
                                : 0}
                              %)
                            </span>
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.low > currentDistribution.low && (
                                <Icons.ArrowUp02 size={16} className="text-success-500" />
                              )}
                            {newDistribution &&
                              currentDistribution &&
                              newDistribution.low < currentDistribution.low && (
                                <Icons.ArrowDown02 size={16} className="text-error-500" />
                              )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
