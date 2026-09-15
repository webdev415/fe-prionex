/**
 * Client-list filter presets, stored by the auth service (#1100).
 *
 * The endpoints only ever act on the caller's own presets — the operator is
 * taken from the token, never from a parameter — which is what makes them
 * private without the client having to ask for the right ones.
 */

import api from '@/lib/api'

import type { ClientFilterPreset, ClientFilterPresetParams } from '../types'

const BASE_URL = '/api/v1/users/me/client-filter-presets'

export interface ClientFilterPresetListResponse {
  presets: ClientFilterPreset[]
}

export interface SaveClientFilterPresetInput {
  name: string
  params: ClientFilterPresetParams
}

export async function getClientFilterPresets(): Promise<ClientFilterPresetListResponse> {
  const response = await api.get<ClientFilterPresetListResponse>(BASE_URL)
  return response.data
}

export async function createClientFilterPreset(
  input: SaveClientFilterPresetInput
): Promise<ClientFilterPreset> {
  const response = await api.post<ClientFilterPreset>(BASE_URL, input)
  return response.data
}

export async function updateClientFilterPreset(
  presetId: number,
  input: SaveClientFilterPresetInput
): Promise<ClientFilterPreset> {
  const response = await api.patch<ClientFilterPreset>(`${BASE_URL}/${presetId}`, input)
  return response.data
}

export async function deleteClientFilterPreset(presetId: number): Promise<void> {
  await api.delete(`${BASE_URL}/${presetId}`)
}
