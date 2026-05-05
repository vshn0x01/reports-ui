export type UserRole = 'operations' | 'central-ops' | 'insurance' | 'finance'

export type UserProfile = {
  id: string
  /** Shown as profile / display name; maps to API `full_name`. */
  name: string
  email: string
  role: UserRole
  /** API `username` (e.g. auth/me). */
  username?: string
  department?: string
  /** From assignments[].role_name (API). */
  roleName?: string
  /** From assignments[].scope_name (API). */
  scopeName?: string
}

export type AuthRecord = UserProfile & {
  username: string
  password: string
}

export type ReportCategory = 'operations' | 'collections' | 'compliance' | 'finance'

export type ReportDefinition = {
  id: string
  name: string
  description: string
  category: ReportCategory
  cadence: 'Daily' | 'Weekly' | 'Monthly' | 'On Demand'
  format: 'CSV' | 'XLSX' | 'PDF'
  allowedRoles: UserRole[]
}

/** Normalized row from GET /reports (backend already scopes by user). */
export type ReportListItem = {
  id: string
  code: string
  name: string
  description: string
  category: ReportCategory
  cadence: 'Daily' | 'Weekly' | 'Monthly' | 'On Demand'
  format: 'CSV' | 'XLSX' | 'PDF'
  isActive: boolean
}

export type DownloadEntry = {
  id: string
  reportId: string
  reportName: string
  downloadedAt: string
  by: string
}

/** GET /reports/filters — allowed options per dimension (`scope_id` in payloads). */
export type ReportScopeOption = {
  id: number
  code: string
  name: string
}

export type ReportFiltersCatalog = Record<string, ReportScopeOption[]>

/** GET /reports/outstanding/dashboard */
export type OutstandingDashboardKpi = {
  fiod: number
  total_loans: number
  regular_loans: number
  od_loans: number
  pct_regular_loans: number
  pct_od_loans: number
  total_outstanding: number
  od_outstanding: number
  pct_od_exposure: number
}

/** Row from GET /reports/outstanding/summary */
export type OutstandingSummaryRow = {
  loans: number
  outstanding: number
  branch_id: string
  branch_name: string
  od_loans: number
  od_amount: number
  /** First instance of default — when returned by API (`fiod_loans`, `fiod`, or `first_instance_of_default`). */
  fiod_loans?: number
}
