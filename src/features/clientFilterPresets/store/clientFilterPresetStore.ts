/**
 * Where client-list filter presets live (#1100).
 *
 * MVP: persisted in localStorage via Zustand persist — per browser only, the
 * same arrangement (and the same trade) as `tagConfigStore`.
 * TODO: migrate to a backend endpoint so an operator's presets follow them
 * between machines. Which service owns the table is still an open question on
 * the ticket, so the decision is deliberately not made here; everything above
 * this module talks to `useClientFilterPresets`, which is the single file an API
 * swap has to touch.
 *
 * Keyed by operator id rather than stored as one flat list. localStorage is per
 * browser, not per person, and the ticket requires presets be private to the
 * operator who created them — on a shared machine a flat list would hand one
 * operator's presets to the next person to log in.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import type { ClientFilterPreset, ClientFilterPresetParams } from '../types'

interface ClientFilterPresetState {
  /** Operator id → that operator's presets, in creation order. */
  byUser: Record<string, ClientFilterPreset[]>
  create: (userId: string, name: string, params: ClientFilterPresetParams) => void
  update: (userId: string, id: number, name: string, params: ClientFilterPresetParams) => void
  remove: (userId: string, id: number) => void
}

export const useClientFilterPresetStore = create<ClientFilterPresetState>()(
  persist(
    (set) => ({
      byUser: {},

      create: (userId, name, params) =>
        set((state) => ({
          byUser: {
            ...state.byUser,
            [userId]: [
              ...(state.byUser[userId] ?? []),
              // Date.now() is enough for a per-browser id: presets are created
              // one at a time by one person. A server-assigned id replaces it
              // with the endpoint.
              { id: Date.now(), name, params },
            ],
          },
        })),

      update: (userId, id, name, params) =>
        set((state) => ({
          byUser: {
            ...state.byUser,
            [userId]: (state.byUser[userId] ?? []).map((preset) =>
              preset.id === id ? { ...preset, name, params } : preset
            ),
          },
        })),

      remove: (userId, id) =>
        set((state) => ({
          byUser: {
            ...state.byUser,
            [userId]: (state.byUser[userId] ?? []).filter((preset) => preset.id !== id),
          },
        })),
    }),
    { name: 'client-filter-presets' }
  )
)
