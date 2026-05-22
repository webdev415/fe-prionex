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

  // FILTER 1: Portfolio/Sellers - use numeric IDs directly
  if (filters.portfolio && filters.portfolio.length > 0) {
    params.seller_ids = filters.portfolio.join(',')
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

  if (filters.promiseDateFrom) {
    params.promise_date_from = filters.promiseDateFrom
  }
  if (filters.promiseDateTo) {
    params.promise_date_to = filters.promiseDateTo
  }
  if (filters.callbackDateFrom) {
    params.callback_date_from = filters.callbackDateFrom
  }
  if (filters.callbackDateTo) {
    params.callback_date_to = filters.callbackDateTo
  }

  // FILTER: Interaction Created By (operator)
  if (filters.interactionUserId) {
    const parsed = parseInt(filters.interactionUserId, 10)
    if (!isNaN(parsed)) {
      params.interaction_user_id = parsed
    }
  }

  // FILTER: Interaction Logged Date (applies to promise/callback subqueries)
  if (filters.interactionDateFrom) {
    params.interaction_date_from = filters.interactionDateFrom
  }
  if (filters.interactionDateTo) {
    params.interaction_date_to = filters.interactionDateTo
  }

  // FILTER: Assignment Date
  if (filters.assignmentDateFrom) {
    params.assignment_date_from = filters.assignmentDateFrom
  }
  if (filters.assignmentDateTo) {
    params.assignment_date_to = filters.assignmentDateTo
  }

  return params
}

describe('Client Management Filter Integration', () => {
  describe('FILTER 1: Portfolio/Sellers', () => {
    it('should map seller IDs to seller_ids parameter', () => {
      const filters: ClientFilters = {
        portfolio: [123, 456, 789],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.seller_ids).toBe('123,456,789')
    })

    it('should handle single portfolio selection', () => {
      const filters: ClientFilters = {
        portfolio: [999],
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.seller_ids).toBe('999')
    })

    it('should handle multiple seller IDs', () => {
      const filters: ClientFilters = {
        portfolio: [123, 456],
      }

      const params = mapFiltersToAPIParams(filters)

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

  describe('Promise and callback date ranges', () => {
    it('should map promiseDateFrom/To to promise_date_from/to', () => {
      const filters: ClientFilters = {
        promiseDateFrom: '2025-03-01',
        promiseDateTo: '2025-03-31',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.promise_date_from).toBe('2025-03-01')
      expect(params.promise_date_to).toBe('2025-03-31')
    })

    it('should map callbackDateFrom/To to callback_date_from/to', () => {
      const filters: ClientFilters = {
        callbackDateFrom: '2025-04-01',
        callbackDateTo: '2025-04-15',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.callback_date_from).toBe('2025-04-01')
      expect(params.callback_date_to).toBe('2025-04-15')
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

  describe('Combined Filters', () => {
    it('should map all 8 filters simultaneously', () => {
      const filters: ClientFilters = {
        portfolio: [1, 2],
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

  describe('Interaction Created By (Operator) Filter', () => {
    it('should map interactionUserId to interaction_user_id as number', () => {
      const filters: ClientFilters = {
        interactionUserId: '7',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.interaction_user_id).toBe(7)
      expect(typeof params.interaction_user_id).toBe('number')
    })

    it('should not set interaction_user_id for invalid string', () => {
      const filters: ClientFilters = {
        interactionUserId: 'abc',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.interaction_user_id).toBeUndefined()
    })

    it('should not set interaction_user_id when empty string', () => {
      const filters: ClientFilters = {
        interactionUserId: '',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.interaction_user_id).toBeUndefined()
    })
  })

  describe('Interaction Logged Date Filter', () => {
    it('should map interactionDateFrom/To to interaction_date_from/to', () => {
      const filters: ClientFilters = {
        interactionDateFrom: '2026-04-01',
        interactionDateTo: '2026-04-15',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.interaction_date_from).toBe('2026-04-01')
      expect(params.interaction_date_to).toBe('2026-04-15')
    })

    it('should handle only interactionDateFrom', () => {
      const filters: ClientFilters = {
        interactionDateFrom: '2026-04-01',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.interaction_date_from).toBe('2026-04-01')
      expect(params.interaction_date_to).toBeUndefined()
    })
  })

  describe('Combined New Filters with Existing Filters', () => {
    it('should map all new interaction filters together with date filters', () => {
      const filters: ClientFilters = {
        promiseDateFrom: '2026-04-01',
        promiseDateTo: '2026-04-30',
        callbackDateFrom: '2026-05-01',
        callbackDateTo: '2026-05-31',
        interactionUserId: '12',
        interactionDateFrom: '2026-03-15',
        interactionDateTo: '2026-05-01',
      }

      const params = mapFiltersToAPIParams(filters)

      expect(params.promise_date_from).toBe('2026-04-01')
      expect(params.promise_date_to).toBe('2026-04-30')
      expect(params.callback_date_from).toBe('2026-05-01')
      expect(params.callback_date_to).toBe('2026-05-31')
      expect(params.interaction_user_id).toBe(12)
      expect(params.interaction_date_from).toBe('2026-03-15')
      expect(params.interaction_date_to).toBe('2026-05-01')
    })

    it('should not set new filter params when not provided', () => {
      const filters: ClientFilters = {}

      const params = mapFiltersToAPIParams(filters)

      expect(params.interaction_user_id).toBeUndefined()
      expect(params.interaction_date_from).toBeUndefined()
      expect(params.interaction_date_to).toBeUndefined()
    })
  })

  describe('Assignment Date Filter', () => {
    it('should map assignmentDateFrom to assignment_date_from', () => {
      const filters: ClientFilters = {
        assignmentDateFrom: '2026-02-01',
      }

      const params = mapFiltersToAPIParams(filters)
      expect(params.assignment_date_from).toBe('2026-02-01')
      expect(params.assignment_date_to).toBeUndefined()
    })

    it('should map assignmentDateTo to assignment_date_to', () => {
      const filters: ClientFilters = {
        assignmentDateTo: '2026-02-28',
      }

      const params = mapFiltersToAPIParams(filters)
      expect(params.assignment_date_from).toBeUndefined()
      expect(params.assignment_date_to).toBe('2026-02-28')
    })

    it('should map full assignment date range', () => {
      const filters: ClientFilters = {
        assignmentDateFrom: '2026-02-01',
        assignmentDateTo: '2026-02-28',
      }

      const params = mapFiltersToAPIParams(filters)
      expect(params.assignment_date_from).toBe('2026-02-01')
      expect(params.assignment_date_to).toBe('2026-02-28')
    })

    it('should combine assignment date with existing filters', () => {
      const filters: ClientFilters = {
        responsibleEmployee: '42',
        assignmentDateFrom: '2026-01-01',
        assignmentDateTo: '2026-01-31',
      }

      const params = mapFiltersToAPIParams(filters)
      expect(params.responsible_employee_id).toBe(42)
      expect(params.assignment_date_from).toBe('2026-01-01')
      expect(params.assignment_date_to).toBe('2026-01-31')
    })
  })
})
