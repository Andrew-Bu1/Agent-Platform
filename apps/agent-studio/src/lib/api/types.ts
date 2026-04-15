// Mirrors com.agentplatform.dto.ApiResponse
export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
}

// Mirrors com.agentplatform.access.dto.AuthResponse
export interface AuthResponse {
  accessToken: string
  refreshToken: string
  tokenType: string
  expiresIn: number // seconds
}

// Mirrors com.agentplatform.access.dto.LoginRequest
export interface LoginRequest {
  email: string
  password: string
}

// Mirrors com.agentplatform.access.dto.SignupRequest
export interface SignupRequest {
  email: string
  name: string
  password: string
  tenantName: string
}

// Mirrors com.agentplatform.access.dto.LogoutRequest
export interface LogoutRequest {
  refreshToken: string
}
