/**
 * Portfolio/Seller Integration Tests
 *
 * Tests for seller data integration in ClientFiltersBar.
 * Verifies portfolio options are properly loaded from sellers API.
 */

import { describe, it, expect } from 'vitest'
import type { Seller } from '@/features/sellers/types'

/**
 * Helper function to map sellers to portfolio options
 * This mirrors the logic in ClientFiltersBar.tsx portfolioOptions useMemo
 */
function mapSellersToPortfolioOptions(sellers: Seller[]): string[] {
  return sellers.map((seller) => `${seller.seller_name} (${seller.id})`)
}

/**
 * Helper function to extract seller IDs from portfolio selections
 * Used when filtering clients by portfolio
 */
function extractSellerIds(portfolioSelections: string[]): string[] {
  return portfolioSelections
    .map((portfolio) => {
      const match = portfolio.match(/\((\d+)\)$/)
      return match ? match[1] : null
    })
    .filter((id): id is string => id !== null)
}

describe('Portfolio/Seller Integration', () => {
  const mockSellers: Seller[] = [
    {
      id: 1,
      seller_name: 'ABC Corporation',
      seller_code: 'ABC',
      seller_type: 'bank',
      address: '123 Main St',
      contact_email: 'contact@abc.com',
      contact_phone: '+380501234567',
      is_active: true,
      is_verified: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      seller_name: 'XYZ Limited',
      seller_code: 'XYZ',
      seller_type: 'mfo',
      address: '456 Oak Ave',
      contact_email: 'info@xyz.com',
      contact_phone: '+380502345678',
      is_active: true,
      is_verified: true,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    },
    {
      id: 15,
      seller_name: 'Global Trade Inc',
      seller_code: 'GTI',
      seller_type: 'collection_agency',
      address: '789 Pine Rd',
      contact_email: 'sales@globaltrade.com',
      contact_phone: '+380503456789',
      is_active: true,
      is_verified: true,
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    },
  ]

  describe('mapSellersToPortfolioOptions', () => {
    it('should map sellers to "Seller Name (ID)" format', () => {
      const portfolioOptions = mapSellersToPortfolioOptions(mockSellers)

      expect(portfolioOptions).toEqual([
        'ABC Corporation (1)',
        'XYZ Limited (2)',
        'Global Trade Inc (15)',
      ])
    })

    it('should handle empty sellers array', () => {
      const portfolioOptions = mapSellersToPortfolioOptions([])

      expect(portfolioOptions).toEqual([])
    })

    it('should handle single seller', () => {
      const singleSeller = [mockSellers[0]]
      const portfolioOptions = mapSellersToPortfolioOptions(singleSeller)

      expect(portfolioOptions).toEqual(['ABC Corporation (1)'])
    })

    it('should preserve seller ID in format', () => {
      const portfolioOptions = mapSellersToPortfolioOptions(mockSellers)

      portfolioOptions.forEach((option, index) => {
        expect(option).toContain(`(${mockSellers[index].id})`)
      })
    })
  })

  describe('extractSellerIds', () => {
    it('should extract single seller ID from portfolio selection', () => {
      const selections = ['ABC Corporation (1)']
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual(['1'])
    })

    it('should extract multiple seller IDs from portfolio selections', () => {
      const selections = ['ABC Corporation (1)', 'XYZ Limited (2)', 'Global Trade Inc (15)']
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual(['1', '2', '15'])
    })

    it('should handle multi-digit seller IDs', () => {
      const selections = ['Company A (123)', 'Company B (9999)', 'Company C (42)']
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual(['123', '9999', '42'])
    })

    it('should filter out invalid formats', () => {
      const selections = [
        'Valid Seller (123)',
        'Invalid Format',
        'No ID Here',
        'Another Valid (456)',
      ]
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual(['123', '456'])
    })

    it('should handle empty selections', () => {
      const selections: string[] = []
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual([])
    })

    it('should handle seller names with special characters', () => {
      const selections = [
        'Seller & Co. (100)',
        'Buyer-Seller LLC (200)',
        'Company #1 (300)',
        'Firm (Europe) Ltd (400)',
      ]
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual(['100', '200', '300', '400'])
    })

    it('should only match IDs at the end of string', () => {
      const selections = [
        'Company (123) - Main Branch (456)', // Should extract 456, not 123
        'Seller (999)',
      ]
      const sellerIds = extractSellerIds(selections)

      expect(sellerIds).toEqual(['456', '999'])
    })
  })

  describe('Round-trip conversion', () => {
    it('should correctly convert sellers to options and back to IDs', () => {
      // Step 1: Convert sellers to portfolio options
      const portfolioOptions = mapSellersToPortfolioOptions(mockSellers)

      // Step 2: User selects some portfolios (simulated)
      const userSelections = [portfolioOptions[0], portfolioOptions[2]] // Select 1st and 3rd

      // Step 3: Extract seller IDs for API call
      const sellerIds = extractSellerIds(userSelections)

      // Verify IDs match original seller IDs
      expect(sellerIds).toEqual(['1', '15'])
    })

    it('should maintain ID integrity through selection process', () => {
      const sellers: Seller[] = [
        { ...mockSellers[0], id: 9999 },
        { ...mockSellers[1], id: 1 },
        { ...mockSellers[2], id: 12345 },
      ]

      const options = mapSellersToPortfolioOptions(sellers)
      const allSelected = extractSellerIds(options)

      expect(allSelected).toEqual(['9999', '1', '12345'])
    })
  })

  describe('API Integration Scenarios', () => {
    it('should generate comma-separated seller_ids for API', () => {
      const portfolioOptions = mapSellersToPortfolioOptions(mockSellers)
      const userSelections = portfolioOptions // Select all

      const sellerIds = extractSellerIds(userSelections)
      const apiParam = sellerIds.join(',')

      expect(apiParam).toBe('1,2,15')
    })

    it('should handle partial selection', () => {
      const portfolioOptions = mapSellersToPortfolioOptions(mockSellers)
      const userSelections = [portfolioOptions[1]] // Select only 2nd seller

      const sellerIds = extractSellerIds(userSelections)
      const apiParam = sellerIds.join(',')

      expect(apiParam).toBe('2')
    })

    it('should return empty string for no selection', () => {
      const userSelections: string[] = []

      const sellerIds = extractSellerIds(userSelections)
      const apiParam = sellerIds.join(',')

      expect(apiParam).toBe('')
    })
  })

  describe('Edge Cases', () => {
    it('should handle sellers with numeric names', () => {
      const sellers: Seller[] = [{ ...mockSellers[0], seller_name: '123 Company', id: 999 }]

      const options = mapSellersToPortfolioOptions(sellers)
      expect(options).toEqual(['123 Company (999)'])

      const ids = extractSellerIds(options)
      expect(ids).toEqual(['999'])
    })

    it('should handle sellers with parentheses in name', () => {
      const sellers: Seller[] = [
        { ...mockSellers[0], seller_name: 'Company (Europe)', id: 555 },
        { ...mockSellers[1], seller_name: 'Seller (Asia) Ltd', id: 666 },
      ]

      const options = mapSellersToPortfolioOptions(sellers)
      expect(options).toEqual(['Company (Europe) (555)', 'Seller (Asia) Ltd (666)'])

      const ids = extractSellerIds(options)
      // Regex should match the last (ID) pattern
      expect(ids).toEqual(['555', '666'])
    })

    it('should handle very long seller names', () => {
      const longName =
        'Very Long Company Name That Exceeds Normal Length For Testing Purposes Corporation Limited'
      const sellers: Seller[] = [{ ...mockSellers[0], seller_name: longName, id: 1 }]

      const options = mapSellersToPortfolioOptions(sellers)
      expect(options[0]).toContain(longName)
      expect(options[0]).toContain('(1)')

      const ids = extractSellerIds(options)
      expect(ids).toEqual(['1'])
    })

    it('should handle Unicode characters in seller names', () => {
      const sellers: Seller[] = [
        { ...mockSellers[0], seller_name: 'Компанія ТОВ "Україна"', id: 100 },
        { ...mockSellers[1], seller_name: 'Société Française', id: 200 },
      ]

      const options = mapSellersToPortfolioOptions(sellers)
      const ids = extractSellerIds(options)

      expect(ids).toEqual(['100', '200'])
    })
  })
})
