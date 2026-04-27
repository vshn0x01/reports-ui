export type UserRole = 'operations' | 'central-ops' | 'insurance' | 'finance'

export type UserProfile = {
  id: string
  name: string
  email: string
  role: UserRole
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

export type DownloadEntry = {
  id: string
  reportId: string
  reportName: string
  downloadedAt: string
  by: string
}
