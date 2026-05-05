import { AUTH_LOGIN_URL, AUTH_ME_URL } from '../config/variables'
import type { UserProfile, UserRole } from '../types'

type LoginRequest = {
  username: string
  password: string
}

type LoginApiResponse = {
  access_token?: string
  token_type?: string
  id?: string
  userId?: string
  name?: string
  fullName?: string
  email?: string
  role?: string
  user?: {
    id?: string
    userId?: string
    name?: string
    fullName?: string
    email?: string
    role?: string
  }
}

export const ACCESS_TOKEN_STORAGE_KEY = 'reports-ui-access-token'

export type LoginResult = {
  accessToken: string
  profile: UserProfile | null
}

const validRoles: UserRole[] = ['operations', 'central-ops', 'insurance', 'finance']

const toUserRole = (value: unknown): UserRole | null => {
  if (typeof value !== 'string') {
    return null
  }
  return validRoles.includes(value as UserRole) ? (value as UserRole) : null
}

const normalizeLoginResponse = (payload: LoginApiResponse): UserProfile | null => {
  const source = payload.user ?? payload

  const id = source.id ?? source.userId
  const name = source.name ?? source.fullName
  const { email } = source
  const role = toUserRole(source.role)

  if (!id || !name || !email || !role) {
    return null
  }

  return { id, name, email, role }
}

export const loginWithApi = async (request: LoginRequest): Promise<LoginResult> => {
  const response = await fetch(AUTH_LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error('Invalid username or password.')
  }

  const payload = (await response.json()) as LoginApiResponse
  const accessToken = payload.access_token

  if (!accessToken) {
    throw new Error('Login response is missing access token.')
  }

  const profile = normalizeLoginResponse(payload)

  return {
    accessToken,
    profile,
  }
}

export const setAccessToken = (accessToken: string) => {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken)
}

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)

export const clearAccessToken = () => {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

export const getAuthHeaders = (): HeadersInit => {
  const accessToken = getAccessToken()
  if (!accessToken) {
    return {}
  }
  return {
    Authorization: `Bearer ${accessToken}`,
  }
}

export const authorizedFetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  const existingHeaders = init.headers ?? {}
  return fetch(input, {
    ...init,
    headers: {
      ...existingHeaders,
      ...getAuthHeaders(),
    },
  })
}

type AuthMeAssignment = {
  role_code: string
  role_name: string
  scope_type: string
  scope_id: number
  scope_code: string
  scope_name: string
}

type AuthMeResponse = {
  id: string
  username: string
  email: string
  active?: boolean
  assignments: AuthMeAssignment[]
  full_name: string
  department?: string
}

const mapRoleCodeToUserRole = (code: string): UserRole => {
  const c = code.toLowerCase()
  if (c.includes('central') || c.includes('cops')) {
    return 'central-ops'
  }
  if (c.includes('insurance')) {
    return 'insurance'
  }
  if (c.includes('finance') || c.includes('fin')) {
    return 'finance'
  }
  return 'operations'
}

export const normalizeAuthMeResponse = (payload: AuthMeResponse): UserProfile => {
  const assignments = Array.isArray(payload.assignments) ? payload.assignments : []
  const primary = assignments[0]
  const roleCode = primary?.role_code ?? ''
  const role = roleCode ? mapRoleCodeToUserRole(roleCode) : 'operations'

  const roleNames = assignments.map((a) => a.role_name).filter(Boolean)
  const scopeNames = assignments.map((a) => a.scope_name).filter(Boolean)

  return {
    id: payload.id,
    name: payload.full_name?.trim() || payload.username,
    email: payload.email,
    role,
    username: payload.username,
    department: payload.department,
    roleName: roleNames.length > 0 ? roleNames.join(', ') : primary?.role_name,
    scopeName: scopeNames.length > 0 ? scopeNames.join(', ') : primary?.scope_name,
  }
}

export const fetchAuthMe = async (): Promise<UserProfile> => {
  const response = await authorizedFetch(AUTH_ME_URL, {
    method: 'GET',
    headers: {
      Accept: '*/*',
    },
  })

  if (!response.ok) {
    throw new Error('Failed to load user profile.')
  }

  const payload = (await response.json()) as AuthMeResponse
  return normalizeAuthMeResponse(payload)
}
