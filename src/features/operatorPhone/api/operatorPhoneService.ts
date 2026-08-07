import api, { API_BASE_URL } from '@/lib/api'

// The short-lived operator phone token minted by the CRM dialer-service for the
// authenticated operator (KAN-353). The CRM access token is attached by the
// shared axios instance, so this is the "one login" hand-off: CRM session in,
// phone JWT out. The token is returned in the body (never a URL).
export interface PhoneTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  aor: string
}

export async function issuePhoneToken(): Promise<PhoneTokenResponse> {
  const response = await api.post(`${API_BASE_URL}/api/v1/operator/phone-token`)
  return response.data
}
