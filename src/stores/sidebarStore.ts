import { create } from 'zustand'

interface SidebarState {
  isOpenSideBar: boolean
  isHoverOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
  setHoverOpen: (isOpen: boolean) => void
}

// Helper functions for localStorage
const STORAGE_KEY = 'sidebar-storage'

const getStoredSidebarState = (): boolean => {
  if (typeof window === 'undefined') return false
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : false
  } catch {
    return false
  }
}

const setStoredSidebarState = (isOpen: boolean): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(isOpen))
  } catch {
    // Ignore localStorage errors
  }
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isOpenSideBar: getStoredSidebarState(),
  isHoverOpen: false,
  toggleSidebar: () =>
    set((state) => {
      const newState = !state.isOpenSideBar
      setStoredSidebarState(newState)
      return { isOpenSideBar: newState, isHoverOpen: false }
    }),
  setSidebarOpen: (isOpen: boolean) => {
    setStoredSidebarState(isOpen)
    set({ isOpenSideBar: isOpen, isHoverOpen: false })
  },
  setHoverOpen: (isOpen: boolean) => {
    set((state) => {
      // Only allow hover open if sidebar is not already clicked open
      if (!state.isOpenSideBar) {
        return { isHoverOpen: isOpen }
      }
      return state
    })
  },
}))
