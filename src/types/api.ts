// API Error Types based on requirements
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMIT_EXCEEDED'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'

export interface ApiError {
  code: ApiErrorCode
  message: string
  details?: Record<string, string[]>
  timestamp: string
}

export interface ApiResponse<T> {
  data: T
  meta?: {
    page?: number
    limit?: number
    total?: number
  }
}

// Auth types - matches backend /api/v1/auth/login response
export interface UserProject {
  id: string
  name: string
  code?: string // Project code (available from /api/v1/users/me)
  roles: UserRole[]
}

export interface UserRole {
  id: string
  name: string
}

// Backend response from /api/v1/users/me
export interface CurrentUserResponse {
  id: number
  username: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  status: string
  language: string
  timezone: string
  phone?: string | null
  role: {
    id: number
    name: string
  }
  active_project: {
    id: number
    name: string
    code: string
  }
  department_id?: number | null
  department_name?: string | null
  group_id?: number | null
  group_name?: string | null
  active_department_id?: number | null
  projects: Array<{
    id: number
    name: string
    code: string
    role_name: string
  }>
  permissions: string[]
  last_login_at?: string | null
  created_at: string
  asterisk_extension?: string
  is_agent?: boolean
  agent_status?: string
  must_change_password?: boolean
  /** Whether the user has Google Authenticator (TOTP) enabled. */
  two_factor_enabled?: boolean
}

export interface User {
  id: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  fullName?: string
  projects: UserProject[]
  active_project_id: string | null
  active_role_id: string | null
  active_role_name: string | null
  active_department_id: number | null
  active_department_name?: string | null
  active_group_id?: number | null
  active_group_name?: string | null
  permissions?: string[]
  createdAt?: string
  updatedAt?: string
  asterisk_extension?: string
  is_agent?: boolean
  agent_status?: string
  timezone?: string
  /** Backend UI language preference (uk | en; legacy `ru` may still appear as string). */
  language?: string
  mustChangePassword?: boolean
  /** Mirrors backend `two_factor_enabled` for the dashboard 2FA toggle. */
  twoFactorEnabled?: boolean
}

/** PATCH /api/v1/users/me — self-service profile (no admin permission). */
export interface UpdateMyProfileInput {
  email?: string
  first_name?: string
  last_name?: string
  middle_name?: string
  phone?: string
  language?: 'uk' | 'en'
  timezone?: string
  agent_status?: string
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  /** JWT access token. Absent when `two_factor_required` is true. */
  token?: string
  /** User info from the auth service. Absent when `two_factor_required` is true. */
  user?: User
  /** True when the account has 2FA enabled — caller must POST /login/verify-two-factor. */
  two_factor_required?: boolean
  /** Short-lived challenge token to replay to /login/verify-two-factor. */
  two_factor_token?: string
}

export interface VerifyTwoFactorRequest {
  two_factor_token: string
  /** 6-digit TOTP code or 17-char `xxxxxxxx-xxxxxxxx` backup code. */
  code: string
}

// ─── Two-Factor Authentication (Google Authenticator) ──────────────────────
export interface TwoFactorStatusResponse {
  enabled: boolean
  backup_codes_remaining: number
  enabled_at?: string | null
}

export interface TwoFactorSetupResponse {
  secret: string
  otpauth_uri: string
  /** Server-rendered PNG, base64-encoded (no `data:` prefix). */
  qr_png_base64: string
}

export interface TwoFactorEnableRequest {
  code: string
}

export interface TwoFactorEnableResponse {
  success: boolean
  message: string
  /** Shown ONCE; not retrievable afterwards. */
  backup_codes: string[]
}

export interface TwoFactorDisableRequest {
  password: string
  code: string
}

export interface TwoFactorRegenerateRequest {
  password: string
  code: string
}

export interface TwoFactorBackupCodesResponse {
  backup_codes: string[]
}

export interface ImpersonationResponse {
  success: boolean
  message: string
  data: {
    impersonation_token: string
    impersonated_user: {
      id: number
      username: string
      email: string
      first_name: string
      last_name: string
    }
    active_project: {
      project_id: number
      project_name: string
      role_id: number
      role_name: string
    }
    permissions: string[]
  }
}

export interface ExitImpersonationResponse {
  success: boolean
  message: string
  data: {
    admin_token: string
    admin_user: CurrentUserResponse
  }
}

export interface ActiveProjectInfo {
  project_id: number
  project_name: string
  project_code: string
  role_id: number
  role_name: string
  permissions: string[]
}

export interface AvailableProject {
  project_id: number
  project_name: string
  role_name: string
}

export interface SwitchProjectResponse {
  success: boolean
  message: string
  access_token: string
  token_type: string
  expires_in: number
  active_project: ActiveProjectInfo
  available_projects: AvailableProject[]
}

export interface TokenValidatePayload {
  user_id: number
  username: string
  active_project_id?: number
  active_role_id?: number
  active_role_name?: string
}

export interface TokenValidateResponse {
  valid: boolean
  payload?: TokenValidatePayload
  expires_in?: number
  error?: string
  message?: string
}

// Auth error states
export type AuthErrorState =
  | 'INVALID_CREDENTIALS'
  | 'ACCOUNT_LOCKED'
  | 'ALREADY_LOGGED_IN'
  | 'SESSION_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'TWO_FACTOR_REQUIRED'
  | 'IP_NOT_ALLOWED'

export interface AuthErrorResponse extends ApiError {
  state: AuthErrorState
  lockoutMinutes?: number
}
