/**
 * Client Management Filter Integration Tests
 *
 * Tests for filter parameter mapping and backend API integration.
 * Verifies all 8 filters are properly mapped to GetClientsParams.
 */

import { describe, it, expect } from 'vitest'
import type { ClientFilters } from '../ClientManagementPage'
import type { GetClientsParams } from '@/features/clients/api/types'

/**
 * Helper function to map ClientFilters to GetClientsParams
 * This mirrors the logic in ClientManagementPage.tsx apiParams useMemo
 */
function mapFiltersToAPIParams(
  filters: ClientFilters,
  currentPage: number = 1,
  rowsPerPage: number = 10
): GetClientsParams {
  const params: GetClientsParams = {
    skip: (currentPage - 1) * rowsPerPage,
    limit: rowsPerPage,
    sort_by: 'priority_score',
    sort_order: 'desc',
  }

  // FILTER 1: Portfolio/Sellers - extract IDs from "Seller Name (ID)" format
  if (filters.portfolio && filters.portfolio.length > 0) {
    const sellerIds = filters.portfolio
      .map((portfolio) => {
        const match = portfolio.match(/\((\d+)\)$/)
        return match ? match[1] : null
      })
      .filter((id): id is string => id !== null)
      .join(',')

    if (sellerIds) {
      params.seller_ids = sellerIds
    }
  }

  // FILTER 2: Sale Date Range
  if (filters.dateOfSaleFrom) {
    params.sale_date_from = filters.dateOfSaleFrom
  }
  if (filters.dateOfSaleTo) {
    params.sale_date_to = filters.dateOfSaleTo
  }

  // FILTER 3: Assignment - Employee
  if (filters.responsibleEmployee) {
    params.responsible_employee_id = parseInt(filters.responsibleEmployee)
  }

  // FILTER 4: Assignment - Searcher
  if (filters.responsibleSearcher) {
    params.responsible_searcher_id = parseInt(filters.responsibleSearcher)
  }

  // FILTER 5: Assignment - Unassigned Only
  if (filters.unassignedOnly) {
    params.unassigned_only = true
  }

  // FILTER 6: Principal Amount
  if (filters.principalRangeFrom !== undefined) {
    params.principal_min = filters.principalRangeFrom
  }
  if (filters.principalRangeTo !== undefined) {
    params.principal_max = filters.principalRangeTo
  }

  // FILTER 7: Total Debt Amount
  if (filters.totalDebtRangeFrom !== undefined) {
    params.total_debt_min = filters.totalDebtRangeFrom
  }
  if (filters.totalDebtRangeTo !== undefined) {
    params.total_debt_max = filters.totalDebtRangeTo
  }

  // FILTER 8: Days Past Due
  if (filters.dpdRangeFrom !== undefined) {
    params.dpd_min = filters.dpdRangeFrom
  }
  if (filters.dpdRangeTo !== undefined) {
    params.dpd_max = filters.dpdRangeTo
  }

  // Legacy filters (already working)
  if (filters.debtRangeFrom !== undefined) {
    params.debt_min = filters.debtRangeFrom
  }
  if (filters.debtRangeTo !== undefined) {
    params.debt_max = filters.debtRangeTo
  }

  if (filters.status && filters.status.length > 0) {
    params.status = filters.status.join(',')
  }

  return params
}

describe('Client Management Filter Integration', () => {
  describe('FILTER 1: Portfolio/Sellers', () => {
    it('should extract seller IDs from "Seller Name (ID)" format', () => {
      const filters: ClientFilters = {
        portfolio: ['ABC Corp (123)', 'XYZ Ltd (456)', 'Test Inc (789)'],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.seller_ids).toBe('123,456,789')
    })

    it('should handle single portfolio selection', () => {
      const filters: ClientFilters = {
        portfolio: ['Single Seller (999)'],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.seller_ids).toBe('999')
    })

    it('should ignore invalid portfolio formats', () => {
      const filters: ClientFilters = {
        portfolio: ['Valid Seller (123)', 'Invalid Format', 'Another Valid (456)'],
      }

      const params = mapFiltersToAPIParams(filters)

      // Should only include valid IDs
      expect(params.seller_ids).toBe('123,456')
    })

    it('should not set seller_ids when portfolio is empty', () => {
      const filters: ClientFilters = {
        portfolio: [],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.seller_ids).toBeUndefined()
    })
  })

  describe('FILTER 2: Sale Date Range', () => {
    it('should map dateOfSaleFrom to sale_date_from', () => {
      const filters: ClientFilters = {
        dateOfSaleFrom: '2024-01-01',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.sale_date_from).toBe('2024-01-01')
    })

    it('should map dateOfSaleTo to sale_date_to', () => {
      const filters: ClientFilters = {
        dateOfSaleTo: '2024-12-31',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.sale_date_to).toBe('2024-12-31')
    })

    it('should map both date range filters', () => {
      const filters: ClientFilters = {
        dateOfSaleFrom: '2024-01-01',
        dateOfSaleTo: '2024-12-31',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.sale_date_from).toBe('2024-01-01')
      expect(params.sale_date_to).toBe('2024-12-31')
    })
  })

  describe('FILTER 3: Assignment - Employee', () => {
    it('should map responsibleEmployee to responsible_employee_id', () => {
      const filters: ClientFilters = {
        responsibleEmployee: '42',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.responsible_employee_id).toBe(42)
    })

    it('should convert string ID to number', () => {
      const filters: ClientFilters = {
        responsibleEmployee: '999',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(typeof params.responsible_employee_id).toBe('number')
      expect(params.responsible_employee_id).toBe(999)
    })
  })

  describe('FILTER 4: Assignment - Searcher', () => {
    it('should map responsibleSearcher to responsible_searcher_id', () => {
      const filters: ClientFilters = {
        responsibleSearcher: '15',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.responsible_searcher_id).toBe(15)
    })
  })

  describe('FILTER 5: Assignment - Unassigned Only', () => {
    it('should map unassignedOnly to unassigned_only', () => {
      const filters: ClientFilters = {
        unassignedOnly: true,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.unassigned_only).toBe(true)
    })

    it('should not set unassigned_only when false', () => {
      const filters: ClientFilters = {
        unassignedOnly: false,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.unassigned_only).toBeUndefined()
    })
  })

  describe('FILTER 6: Principal Amount', () => {
    it('should map principalRangeFrom to principal_min', () => {
      const filters: ClientFilters = {
        principalRangeFrom: 10000,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.principal_min).toBe(10000)
    })

    it('should map principalRangeTo to principal_max', () => {
      const filters: ClientFilters = {
        principalRangeTo: 50000,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.principal_max).toBe(50000)
    })

    it('should map both principal range filters', () => {
      const filters: ClientFilters = {
        principalRangeFrom: 10000,
        principalRangeTo: 50000,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.principal_min).toBe(10000)
      expect(params.principal_max).toBe(50000)
    })
  })

  describe('FILTER 7: Total Debt Amount', () => {
    it('should map totalDebtRangeFrom to total_debt_min', () => {
      const filters: ClientFilters = {
        totalDebtRangeFrom: 20000,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.total_debt_min).toBe(20000)
    })

    it('should map totalDebtRangeTo to total_debt_max', () => {
      const filters: ClientFilters = {
        totalDebtRangeTo: 100000,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.total_debt_max).toBe(100000)
    })
  })

  describe('FILTER 8: Days Past Due', () => {
    it('should map dpdRangeFrom to dpd_min', () => {
      const filters: ClientFilters = {
        dpdRangeFrom: 30,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.dpd_min).toBe(30)
    })

    it('should map dpdRangeTo to dpd_max', () => {
      const filters: ClientFilters = {
        dpdRangeTo: 90,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.dpd_max).toBe(90)
    })

    it('should map both DPD range filters', () => {
      const filters: ClientFilters = {
        dpdRangeFrom: 30,
        dpdRangeTo: 90,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.dpd_min).toBe(30)
      expect(params.dpd_max).toBe(90)
    })
  })

  describe('Status Filter (Legacy)', () => {
    it('should map status array to comma-separated string', () => {
      const filters: ClientFilters = {
        status: ['active', 'new', 'closed'],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.status).toBe('active,new,closed')
    })

    it('should handle single status', () => {
      const filters: ClientFilters = {
        status: ['active'],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.status).toBe('active')
    })
  })

  describe('Combined Filters', () => {
    it('should map all 8 filters simultaneously', () => {
      const filters: ClientFilters = {
        portfolio: ['Seller A (1)', 'Seller B (2)'],
        dateOfSaleFrom: '2024-01-01',
        dateOfSaleTo: '2024-12-31',
        responsibleEmployee: '10',
        responsibleSearcher: '20',
        unassignedOnly: false, // Should not be included
        principalRangeFrom: 5000,
        principalRangeTo: 25000,
        totalDebtRangeFrom: 10000,
        totalDebtRangeTo: 50000,
        dpdRangeFrom: 10,
        dpdRangeTo: 60,
        status: ['active', 'new'],
      }

      const params = mapFiltersToAPIParams(filters)

      // Verify all filters are mapped
      expect(params.seller_ids).toBe('1,2')
      expect(params.sale_date_from).toBe('2024-01-01')
      expect(params.sale_date_to).toBe('2024-12-31')
      expect(params.responsible_employee_id).toBe(10)
      expect(params.responsible_searcher_id).toBe(20)
      expect(params.unassigned_only).toBeUndefined() // false should not be set
      expect(params.principal_min).toBe(5000)
      expect(params.principal_max).toBe(25000)
      expect(params.total_debt_min).toBe(10000)
      expect(params.total_debt_max).toBe(50000)
      expect(params.dpd_min).toBe(10)
      expect(params.dpd_max).toBe(60)
      expect(params.status).toBe('active,new')
    })

    it('should include pagination and sorting in params', () => {
      const filters: ClientFilters = {}
      const currentPage = 3
      const rowsPerPage = 50

      const params = mapFiltersToAPIParams(filters, currentPage, rowsPerPage)

      expect(params.skip).toBe(100) // (3-1) * 50
      expect(params.limit).toBe(50)
      expect(params.sort_by).toBe('priority_score')
      expect(params.sort_order).toBe('desc')
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty filters', () => {
      const filters: ClientFilters = {}

      const params = mapFiltersToAPIParams(filters)

      // Should only have pagination and default sorting
      expect(params.skip).toBe(0)
      expect(params.limit).toBe(10)
      expect(params.sort_by).toBe('priority_score')
      expect(params.sort_order).toBe('desc')

      // No filters should be set
      expect(params.seller_ids).toBeUndefined()
      expect(params.sale_date_from).toBeUndefined()
      expect(params.responsible_employee_id).toBeUndefined()
      expect(params.principal_min).toBeUndefined()
      expect(params.total_debt_min).toBeUndefined()
      expect(params.dpd_min).toBeUndefined()
      expect(params.status).toBeUndefined()
    })

    it('should handle zero values in number filters', () => {
      const filters: ClientFilters = {
        principalRangeFrom: 0,
        totalDebtRangeFrom: 0,
        dpdRangeFrom: 0,
      }

      const params = mapFiltersToAPIParams(filters)

      // Zero should be included (not treated as falsy)
      expect(params.principal_min).toBe(0)
      expect(params.total_debt_min).toBe(0)
      expect(params.dpd_min).toBe(0)
    })

    it('should handle undefined number values correctly', () => {
      const filters: ClientFilters = {
        principalRangeFrom: undefined,
        totalDebtRangeTo: undefined,
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.principal_min).toBeUndefined()
      expect(params.principal_max).toBeUndefined()
    })
  })
})
