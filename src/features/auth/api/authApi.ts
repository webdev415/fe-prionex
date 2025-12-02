import api from '@/lib/api'
import type { LoginRequest, LoginResponse, User, TokenValidateResponse } from '@/types/api'

export const authApi = {
  login: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/login', data),

  forceLogin: (data: LoginRequest) => api.post<LoginResponse>('/api/v1/auth/force-login', data),

  logout: () => api.post('/api/v1/auth/logout'),

  validate: () => api.post<TokenValidateResponse>('/api/v1/auth/validate'),

  me: () => api.get<User>('/api/v1/users/me'),
}

export default authApi
