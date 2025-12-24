/**
 * Portfolio Dropdown Component
 *
 * Dropdown with search functionality for selecting multiple portfolios.
 */

import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/Checkbox'
import { Button } from '@/components/ui/Button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'

interface PortfolioDropdownProps {
  portfolios: string[]
  selectedPortfolios: string[]
  onSelectionChange: (portfolios: string[]) => void
  onOpenChange?: (open: boolean) => void
  trigger: React.ReactNode
}

export function PortfolioDropdown({
  portfolios,
  selectedPortfolios,
  onSelectionChange,
  onOpenChange,
  trigger,
}: PortfolioDropdownProps) {
  const { t } = useTranslation('common')
  const [searchQuery, setSearchQuery] = useState('')
  const [tempSelection, setTempSelection] = useState<string[]>(selectedPortfolios)
  const [isOpen, setIsOpen] = useState(false)

  // Filter portfolios based on search
  const filteredPortfolios = useMemo(() => {
    if (!searchQuery.trim()) return portfolios
    return portfolios.filter((portfolio) =>
      portfolio.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [portfolios, searchQuery])

  // Initialize temp selection when dropdown opens
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open)
    onOpenChange?.(open)
    if (open) {
      setTempSelection([...selectedPortfolios])
      setSearchQuery('')
    }
  }

  // Sync temp selection when selectedPortfolios changes externally
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTempSelection([...selectedPortfolios])
    }
  }, [selectedPortfolios, isOpen])

  const handleTogglePortfolio = (portfolio: string) => {
    setTempSelection((prev) =>
      prev.includes(portfolio) ? prev.filter((p) => p !== portfolio) : [...prev, portfolio]
    )
  }

  const handleClear = () => {
    setTempSelection([])
  }

  const handleApply = () => {
    onSelectionChange(tempSelection)
    setIsOpen(false)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild className="outline-none">
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={8}
        className="w-[280px] rounded-lg border border-gray-200 bg-white p-0 shadow-lg"
      >
        {/* Search Input */}
        <div className="border-b border-gray-200 p-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('pages.clients.modals.portfolioDropdown.searchPortfolios')}
            className="text-dark-500 focus:border-primary-500 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-gray-400"
          />
        </div>

        {/* Portfolio List */}
        <div className="max-h-[200px] overflow-y-auto p-2">
          {filteredPortfolios.length === 0 ? (
            <div className="py-4 text-center text-sm text-gray-500">
              {t('pages.clients.modals.portfolioDropdown.noPortfoliosFound')}
            </div>
          ) : (
            <div className="space-y-1">
              {filteredPortfolios.map((portfolio) => (
                <label
                  key={portfolio}
                  className="text-dark-500 flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-gray-50"
                >
                  <Checkbox
                    checked={tempSelection.includes(portfolio)}
                    onCheckedChange={() => handleTogglePortfolio(portfolio)}
                  />
                  <span className="text-sm">{portfolio}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-gray-200 p-3">
          <div className="flex items-center gap-2">
            <Button variant="cancel" onClick={handleClear} className="flex flex-1">
              {t('pages.clients.modals.portfolioDropdown.clear')}
            </Button>
            <Button variant="primary" onClick={handleApply} className="flex flex-1">
              {t('pages.clients.modals.portfolioDropdown.apply')}
            </Button>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
