import { create } from 'zustand'

interface SearchState {
  searchQuery: string
  searchType: string
  setSearchQuery: (query: string) => void
  setSearchType: (type: string) => void
  clearSearch: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: '',
  searchType: 'phone',
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSearchType: (type: string) => set({ searchType: type }),
  clearSearch: () => set({ searchQuery: '', searchType: 'phone' }),
}))
