import { create } from 'zustand'

interface SearchState {
  searchQuery: string
  searchType: string
  /** Grows by one on every project switch: the header drops its own search state on it. */
  switchNonce: number
  setSearchQuery: (query: string) => void
  setSearchType: (type: string) => void
  clearSearch: () => void
  /** A project switch: the applied query goes (the type stays) and the header is told. */
  resetForProjectSwitch: () => void
}

export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: '',
  searchType: 'phone',
  switchNonce: 0,
  setSearchQuery: (query: string) => set({ searchQuery: query }),
  setSearchType: (type: string) => set({ searchType: type }),
  clearSearch: () => set({ searchQuery: '', searchType: 'phone' }),
  resetForProjectSwitch: () =>
    set((state) => ({ searchQuery: '', switchNonce: state.switchNonce + 1 })),
}))
