/**
 * Scoring Configuration Page
 *
 * Page for configuring client scoring weights and priority classification thresholds.
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Checkbox } from '@/components/ui/Checkbox'
import { Slider } from '@/components/ui/Slider'
import { PriorityBadge } from '@/pages/ClientManagement/components/PriorityBadge'
import { Icons } from '@/lib/icons'

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

  // Current distribution (mock data)
  const currentDistribution: Distribution = useMemo(
    () => ({
      critical: 45,
      high: 87,
      medium: 156,
      low: 85,
    }),
    []
  )

  // Calculate new distribution (mock calculation)
  const newDistribution: Distribution = useMemo(() => {
    // This would be calculated based on actual client data
    // For now, using mock calculations
    return {
      critical: 52,
      high: 93,
      medium: 148,
      low: 80,
    }
  }, [])

  const totalClients = useMemo(() => {
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
    setPriorityThresholds({
      critical: 25,
      high: 18,
      medium: 10,
      low: 0,
    })
  }

  const handleSave = () => {
    // TODO: Implement save functionality
    console.log('Saving configuration', { scoreWeights, priorityThresholds, immediateEffect })
  }

  const handleCancel = () => {
    // TODO: Implement cancel/reset functionality
    console.log('Canceling changes')
  }

  const formatPercentage = (count: number, total: number) => {
    return Math.round((count / total) * 100)
  }

  return (
    <div className="flex w-full flex-col items-start gap-6">
      {/* Header */}
      <div className="flex w-full items-center justify-between">
        <h1 className="text-dark-500 text-2xl font-semibold">
          {t('pages.scoringConfiguration.title', 'Scoring Configuration - Project Alpha')}
        </h1>
      </div>

      {/* Score Weights Section */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-dark-500 text-lg font-semibold">
            {t('pages.scoringConfiguration.scoreWeights', 'Score Weights')}
          </h2>
          <Button variant="secondary" size="sm" onClick={() => {}} className="rounded-md">
            {t('pages.scoringConfiguration.previewChanges', 'Preview Changes')}
          </Button>
        </div>

        <div className="flex flex-col gap-4">
          <Slider
            label={t('pages.scoringConfiguration.debtAmountWeight', 'Debt Amount Weight')}
            value={scoreWeights.debtAmount}
            onValueChange={(value) => handleWeightChange('debtAmount', value)}
            min={0}
            max={100}
            step={1}
          />

          <Slider
            label={t('pages.scoringConfiguration.daysOverdueWeight', 'Days Overdue Weight')}
            value={scoreWeights.daysOverdue}
            onValueChange={(value) => handleWeightChange('daysOverdue', value)}
            min={0}
            max={100}
            step={1}
          />

          <Slider
            label={t('pages.scoringConfiguration.contactHistoryWeight', 'Contact History Weight')}
            value={scoreWeights.contactHistory}
            onValueChange={(value) => handleWeightChange('contactHistory', value)}
            min={0}
            max={100}
            step={1}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-dark-500 text-sm">
            {t('pages.scoringConfiguration.totalMustEqual', 'Total must equal 100%')}
          </span>
          <span
            className={`text-sm font-medium ${
              totalWeight === 100 ? 'text-success-500' : 'text-error-500'
            }`}
          >
            {t('pages.scoringConfiguration.current', 'Current')}: {totalWeight}%
            {totalWeight === 100 && ' ✓'}
          </span>
        </div>
      </div>
      <div className="flex flex-row gap-4 self-stretch">
        {/* Priority Classification Thresholds Section */}
        <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-dark-500 text-lg font-semibold">
              {t(
                'pages.scoringConfiguration.priorityThresholds',
                'Priority Classification Thresholds'
              )}
            </h2>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleResetDefaults}
              className="rounded-md"
            >
              {t('pages.scoringConfiguration.resetDefaults', 'Reset Defaults')}
            </Button>
          </div>

          <div className="flex flex-row gap-4">
            {/* Critical Priority */}
            <div className="flex items-center gap-4">
              <PriorityBadge priority="Critical" variant="compact" />
              <div className="flex flex-1 items-center gap-2">
                <span className="text-dark-500 w-[100px] text-sm">
                  {t('pages.scoringConfiguration.scoreGreaterThanOrEqual', 'Score ≥')}
                </span>
                <Input
                  type="number"
                  value={priorityThresholds.critical}
                  onChange={(e) => handleThresholdChange('critical', Number(e.target.value) || 0)}
                  className="w-16 rounded-md"
                  inputSize="sm"
                />
              </div>
            </div>

            {/* High Priority */}
            <div className="flex items-center gap-4">
              <PriorityBadge priority="High" variant="compact" />
              <div className="flex flex-1 items-center gap-2">
                <span className="text-dark-500 w-[100px] text-sm">
                  {t('pages.scoringConfiguration.scoreGreaterThanOrEqual', 'Score ≥')}
                </span>
                <Input
                  type="number"
                  value={priorityThresholds.high}
                  onChange={(e) => handleThresholdChange('high', Number(e.target.value) || 0)}
                  className="w-16 rounded-md"
                  inputSize="sm"
                />
              </div>
            </div>

            {/* Medium Priority */}
            <div className="flex items-center gap-4">
              <PriorityBadge priority="Medium" variant="compact" />
              <div className="flex flex-1 items-center gap-2">
                <span className="text-dark-500 w-[100px] text-sm">
                  {t('pages.scoringConfiguration.scoreGreaterThanOrEqual', 'Score ≥')}
                </span>
                <Input
                  type="number"
                  value={priorityThresholds.medium}
                  onChange={(e) => handleThresholdChange('medium', Number(e.target.value) || 0)}
                  className="w-16 rounded-md"
                  inputSize="sm"
                />
              </div>
            </div>

            {/* Low Priority */}
            <div className="flex items-center gap-4">
              <PriorityBadge priority="Low" variant="compact" />
              <span className="text-dark-500 w-[100px] text-sm">
                {t('pages.scoringConfiguration.scoreLessThan', 'Score <')}{' '}
                {priorityThresholds.medium}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="immediate-effect"
              checked={immediateEffect}
              onCheckedChange={(checked) => setImmediateEffect(checked === true ? true : false)}
            />
            <span className="text-dark-500 text-sm font-light">
              {t(
                'pages.scoringConfiguration.immediateEffect',
                'Changes will affect all clients in this project immediately'
              )}
            </span>
          </div>
        </div>

        {/* Seller-Specific Overrides Section */}
        <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
          <h2 className="text-dark-500 text-lg font-semibold">
            {t(
              'pages.scoringConfiguration.sellerOverrides',
              'Seller-Specific Overrides (Optional)'
            )}
          </h2>
          <Button variant="secondary" size="sm" onClick={() => {}} className="rounded-md">
            {t('pages.scoringConfiguration.addSellerConfig', '+ Add Seller-Specific Configuration')}
          </Button>
          <span className="text-dark-500 text-sm font-light">
            {t(
              'pages.scoringConfiguration.sellerOverridesDescription',
              'Configure different thresholds for specific sellers'
            )}
          </span>
        </div>
      </div>

      {/* Configuration Preview Section */}
      <div className="flex w-full flex-col gap-4 rounded-xl border border-white/100 bg-white/50 p-6">
        <h2 className="text-dark-500 text-lg font-semibold">
          {t('pages.scoringConfiguration.configurationPreview', 'Configuration Preview')}
        </h2>

        <div className="grid grid-cols-2 gap-6">
          {/* Current Distribution */}
          <div className="flex flex-col gap-3">
            <h3 className="text-dark-500 text-sm font-semibold">
              {t('pages.scoringConfiguration.currentDistribution', 'Current Distribution:')}
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="Critical" variant="compact" />
                  </div>
                  <span className="text-dark-500 text-sm">
                    {t('pages.clients.priorities.critical', 'Critical')}:{' '}
                    {currentDistribution.critical}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(currentDistribution.critical, totalClients)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="High" variant="compact" />
                  </div>
                  <span className="text-dark-500 text-sm">
                    {t('pages.clients.priorities.high', 'High')}: {currentDistribution.high}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(currentDistribution.high, totalClients)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="Medium" variant="compact" />
                  </div>
                  <span className="text-dark-500 text-sm">
                    {t('pages.clients.priorities.medium', 'Medium')}: {currentDistribution.medium}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(currentDistribution.medium, totalClients)}%)
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="Low" variant="compact" />
                  </div>
                  <span className="text-dark-500 text-sm">
                    {t('pages.clients.priorities.low', 'Low')}: {currentDistribution.low}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(currentDistribution.low, totalClients)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* New Distribution */}
          <div className="flex flex-col gap-3">
            <h3 className="text-dark-500 text-sm font-semibold">
              {t('pages.scoringConfiguration.withNewThresholds', 'With New Thresholds:')}
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="Critical" variant="compact" />
                  </div>
                  <span className="text-dark-500 w-[25%] text-sm">
                    {t('pages.clients.priorities.critical', 'Critical')}: {newDistribution.critical}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(newDistribution.critical, totalClients)}%)
                  </span>
                  {newDistribution.critical > currentDistribution.critical && (
                    <Icons.ArrowUp02 size={16} className="text-success-500" />
                  )}
                  {newDistribution.critical < currentDistribution.critical && (
                    <Icons.ArrowDown02 size={16} className="text-error-500" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="High" variant="compact" />
                  </div>
                  <span className="text-dark-500 w-[25%] text-sm">
                    {t('pages.clients.priorities.high', 'High')}: {newDistribution.high}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(newDistribution.high, totalClients)}%)
                  </span>
                  {newDistribution.high > currentDistribution.high && (
                    <Icons.ArrowUp02 size={16} className="text-success-500" />
                  )}
                  {newDistribution.high < currentDistribution.high && (
                    <Icons.ArrowDown02 size={16} className="text-error-500" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="Medium" variant="compact" />
                  </div>
                  <span className="text-dark-500 w-[25%] text-sm">
                    {t('pages.clients.priorities.medium', 'Medium')}: {newDistribution.medium}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(newDistribution.medium, totalClients)}%)
                  </span>
                  {newDistribution.medium > currentDistribution.medium && (
                    <Icons.ArrowUp02 size={16} className="text-success-500" />
                  )}
                  {newDistribution.medium < currentDistribution.medium && (
                    <Icons.ArrowDown02 size={16} className="text-error-500" />
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <div className="flex w-full items-center gap-2">
                  <div className="w-[16%]">
                    <PriorityBadge priority="Low" variant="compact" />
                  </div>
                  <span className="text-dark-500 w-[25%] text-sm">
                    {t('pages.clients.priorities.low', 'Low')}: {newDistribution.low}{' '}
                    {t('pages.scoringConfiguration.clients', 'clients')} (
                    {formatPercentage(newDistribution.low, totalClients)}%)
                  </span>
                  {newDistribution.low > currentDistribution.low && (
                    <Icons.ArrowUp02 size={16} className="text-success-500" />
                  )}
                  {newDistribution.low < currentDistribution.low && (
                    <Icons.ArrowDown02 size={16} className="text-error-500" />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex w-full items-center justify-between">
        <span className="text-dark-500 text-sm">
          {t('pages.scoringConfiguration.lastUpdated', 'Last Updated:')} 2024-01-15 14:30{' '}
          {t('pages.scoringConfiguration.by', 'by')} Admin User
        </span>
        <div className="flex w-[30%] items-center gap-3">
          <Button
            variant="cancel"
            onClick={handleCancel}
            className="flex-1 self-stretch rounded-md"
          >
            {t('actions.cancel', 'Cancel')}
          </Button>
          <Button variant="primary" onClick={handleSave} className="flex-1 self-stretch rounded-md">
            {t('pages.scoringConfiguration.saveConfiguration', 'Save Configuration')}
          </Button>
        </div>
      </div>
    </div>
  )
}
