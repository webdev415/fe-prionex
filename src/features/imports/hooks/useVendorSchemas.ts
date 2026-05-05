import { useQuery } from '@tanstack/react-query'
import { importsApi } from '../api/importsApi'
import type { VendorSchema } from '../types'

export const vendorSchemasKey = ['import-vendor-schemas'] as const

export function useVendorSchemas() {
  return useQuery<VendorSchema[]>({
    queryKey: vendorSchemasKey,
    queryFn: importsApi.getVendorSchemas,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
