import api from '@/lib/api'
import type {
  LoginRequest,
  LoginResponse,
  TokenValidateResponse,
  CurrentUserResponse,
  ImpersonationResponse,
  ExitImpersonationResponse,
  SwitchProjectResponse,
} from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/login', data),

  forceLogin: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/force-login', data),

  logout: () => api.post('/api/v1/auth/logout'),

  validate: () => api.post<TokenValidateResponse>('/api/v1/auth/validate'),

  me: () => api.get<CurrentUserResponse>('/api/v1/users/me'),

  switchProject: (projectId: number) =>
    api.post<SwitchProjectResponse>('/api/v1/auth/switch-project', { project_id: projectId }),

  impersonate: (userId: string) =>
    api.post<ImpersonationResponse>('/api/v1/auth/impersonate', { user_id: userId }),

  exitImpersonation: () => api.post<ExitImpersonationResponse>('/api/v1/auth/impersonate/exit'),

  changePassword: (data: { current_password?: string; new_password: string }) =>
    api.post('/api/v1/users/me/change-password', data),
}

export default authApi
