import { post } from './client'
import type { AuthResponse, LoginRequest, LogoutRequest, RefreshTokenRequest, SignupRequest, SwitchTenantRequest } from './types'

export const authApi = {
  login(req: LoginRequest) {
    return post<AuthResponse>('/auth/login', req)
  },

  signup(req: SignupRequest) {
    return post<AuthResponse>('/auth/signup', req)
  },

  logout(req: LogoutRequest, accessToken: string) {
    return post<void>('/auth/logout', req, accessToken)
  },

  refresh(req: RefreshTokenRequest) {
    return post<AuthResponse>('/auth/refresh', req)
  },

  switchTenant(req: SwitchTenantRequest, accessToken: string) {
    return post<AuthResponse>('/auth/switch-tenant', req, accessToken)
  },
}
