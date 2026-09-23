import { useEffect } from 'react'

export function useClampPage(
  currentPage: number,
  totalPages: number,
  settled: boolean,
  setPage: (page: number) => void
): void {
  useEffect(() => {
    if (settled && currentPage > totalPages) setPage(totalPages)
  }, [settled, currentPage, totalPages, setPage])
}
