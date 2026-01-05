import { create } from 'zustand'

interface SidebarState {
  isOpenSideBar: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
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
  toggleSidebar: () =>
    set((state) => {
      const newState = !state.isOpenSideBar
      setStoredSidebarState(newState)
      return { isOpenSideBar: newState }
    }),
  setSidebarOpen: (isOpen: boolean) => {
    setStoredSidebarState(isOpen)
    set({ isOpenSideBar: isOpen })
  },
}))
