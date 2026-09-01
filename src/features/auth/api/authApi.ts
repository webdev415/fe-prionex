import api from '@/lib/api'
import type {
  LoginRequest,
  LoginResponse,
  TokenValidateResponse,
  CurrentUserResponse,
  ImpersonationResponse,
  ExitImpersonationResponse,
  SwitchProjectResponse,
  UpdateMyProfileInput,
  VerifyTwoFactorRequest,
  TwoFactorStatusResponse,
  TwoFactorSetupResponse,
  TwoFactorEnableRequest,
  TwoFactorEnableResponse,
  TwoFactorDisableRequest,
  TwoFactorRegenerateRequest,
  TwoFactorBackupCodesResponse,
} from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/login', data),

  forceLogin: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/force-login', data),

  verifyTwoFactor: (data: VerifyTwoFactorRequest) =>
    api.post<LoginResponse>('/api/v1/auth/login/verify-two-factor', data),

  logout: () => api.post('/api/v1/auth/logout'),

  validate: () => api.post<TokenValidateResponse>('/api/v1/auth/validate'),

  me: () => api.get<CurrentUserResponse>('/api/v1/users/me'),

  myProjects: () =>
    api.get<{
      user_id: number
      username: string
      active_project_id: number
      projects: Array<{
        project_id: number
        project_name: string
        project_code: string
        role_id: number
        role_name: string
        permissions: string[]
        is_active: boolean
      }>
      total_projects: number
    }>('/api/v1/users/me/projects'),

  updateMyProfile: (data: UpdateMyProfileInput) =>
    api.patch<CurrentUserResponse>('/api/v1/users/me', data),

  uploadAvatar: (file: File) => {
    const body = new FormData()
    body.append('file', file)
    return api
      .post<CurrentUserResponse>('/api/v1/users/me/avatar', body, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((response) => response.data)
  },

  deleteAvatar: () =>
    api.delete<CurrentUserResponse>('/api/v1/users/me/avatar').then((response) => response.data),

  switchProject: (projectId: number) =>
    api.post<SwitchProjectResponse>('/api/v1/auth/switch-project', { project_id: projectId }),

  impersonate: (userId: string) =>
    api.post<ImpersonationResponse>('/api/v1/auth/impersonate', { user_id: userId }),

  exitImpersonation: () => api.post<ExitImpersonationResponse>('/api/v1/auth/impersonate/exit'),

  changePassword: (data: { current_password?: string; new_password: string }) =>
    api.post('/api/v1/users/me/change-password', data),

  // ─── Two-Factor Authentication ──────────────────────────────────────────
  twoFactor: {
    status: () => api.get<TwoFactorStatusResponse>('/api/v1/users/me/2fa'),

    setup: () => api.post<TwoFactorSetupResponse>('/api/v1/users/me/2fa/setup'),

    enable: (data: TwoFactorEnableRequest) =>
      api.post<TwoFactorEnableResponse>('/api/v1/users/me/2fa/enable', data),

    disable: (data: TwoFactorDisableRequest) =>
      api.post<{ success: boolean; message: string }>('/api/v1/users/me/2fa/disable', data),

    regenerateBackupCodes: (data: TwoFactorRegenerateRequest) =>
      api.post<TwoFactorBackupCodesResponse>('/api/v1/users/me/2fa/backup-codes/regenerate', data),
  },
}

export default authApi
