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
}

export interface User {
  id: string
  username: string
  email?: string
  firstName?: string
  lastName?: string
  projects: UserProject[]
  active_project_id: string | null
  active_role_id: string | null
  active_role_name: string | null
  permissions?: string[]
  createdAt?: string
  updatedAt?: string
  asterisk_extension?: string
  is_agent?: boolean
  agent_status?: string
  timezone?: string
  mustChangePassword?: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  user: User
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

export interface AuthErrorResponse extends ApiError {
  state: AuthErrorState
  lockoutMinutes?: number
}
