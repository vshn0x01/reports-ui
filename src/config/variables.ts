const DEFAULT_API_BASE_URL = import.meta.env.DEV ? '/api' : ''

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL,
)

export const AUTH_LOGIN_URL = `${API_BASE_URL}/auth/login`
export const AUTH_ME_URL = `${API_BASE_URL}/auth/me`
export const REPORTS_URL = `${API_BASE_URL}/reports`
export const REPORTS_FILTERS_URL = `${API_BASE_URL}/reports/filters`
export const REPORTS_OUTSTANDING_SUMMARY_URL = `${API_BASE_URL}/reports/outstanding/summary`
export const REPORTS_OUTSTANDING_DASHBOARD_URL = `${API_BASE_URL}/reports/outstanding/dashboard`

export const reportExcelExportUrl = (reportId: string) =>
  `${API_BASE_URL}/reports/${encodeURIComponent(reportId)}/export/excel`
