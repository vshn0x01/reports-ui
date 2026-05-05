import {
  REPORTS_OUTSTANDING_DASHBOARD_URL,
  REPORTS_OUTSTANDING_SUMMARY_URL,
  REPORTS_URL,
  reportExcelExportUrl,
} from '../config/variables'
import {
  buildOutstandingSummarySearchParams,
  type ScopeFiltersState,
} from '../scope/reportScopes'
import type {
  OutstandingDashboardKpi,
  OutstandingSummaryRow,
  ReportCategory,
  ReportListItem,
} from '../types'
import { authorizedFetch } from './auth'

type ReportsApiRow = {
  id: string
  code: string
  name: string
  description: string
  category: string
  cadence: string
  output_format: string
  is_active: boolean
  created_at?: string
}

const reportCategories: ReportCategory[] = ['operations', 'collections', 'compliance', 'finance']

const normalizeCategory = (raw: string): ReportCategory => {
  const c = raw.trim().toLowerCase().replace(/\s+/g, '_')
  if (reportCategories.includes(c as ReportCategory)) {
    return c as ReportCategory
  }
  return 'operations'
}

const normalizeCadence = (raw: string): ReportListItem['cadence'] => {
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_')
  const map: Record<string, ReportListItem['cadence']> = {
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
    on_demand: 'On Demand',
    ondemand: 'On Demand',
  }
  return map[key] ?? 'On Demand'
}

const normalizeFormat = (raw: string): ReportListItem['format'] => {
  const key = raw.trim().toLowerCase()
  const map: Record<string, ReportListItem['format']> = {
    csv: 'CSV',
    xlsx: 'XLSX',
    pdf: 'PDF',
  }
  return map[key] ?? 'CSV'
}

export const mapApiReportToListItem = (row: ReportsApiRow): ReportListItem => ({
  id: row.id,
  code: row.code,
  name: row.name,
  description: row.description,
  category: normalizeCategory(row.category),
  cadence: normalizeCadence(row.cadence),
  format: normalizeFormat(row.output_format),
  isActive: row.is_active,
})

export const fetchReports = async (): Promise<ReportListItem[]> => {
  const response = await authorizedFetch(REPORTS_URL, {
    method: 'GET',
    headers: {
      Accept: '*/*',
    },
  })

  if (!response.ok) {
    throw new Error('Could not load reports.')
  }

  const payload = (await response.json()) as ReportsApiRow[]
  if (!Array.isArray(payload)) {
    throw new Error('Invalid reports response.')
  }

  return payload.map(mapApiReportToListItem)
}

const mapOutstandingSummaryRow = (raw: unknown): OutstandingSummaryRow => {
  const row = raw as Record<string, unknown>
  const firstInst = row.first_instance_of_default
  const fromApi =
    typeof row.fiod_loans === 'number' && Number.isFinite(row.fiod_loans)
      ? row.fiod_loans
      : typeof row.fiod === 'number' && Number.isFinite(row.fiod)
        ? row.fiod
        : typeof firstInst === 'number' && Number.isFinite(firstInst)
          ? firstInst
          : undefined
  const base = raw as OutstandingSummaryRow
  return fromApi === undefined ? base : { ...base, fiod_loans: fromApi }
}

export const fetchOutstandingSummary = async (
  filters: ScopeFiltersState,
): Promise<OutstandingSummaryRow[]> => {
  const params = buildOutstandingSummarySearchParams(filters)
  const query = params.toString()
  const url = query ? `${REPORTS_OUTSTANDING_SUMMARY_URL}?${query}` : REPORTS_OUTSTANDING_SUMMARY_URL

  const response = await authorizedFetch(url, {
    method: 'GET',
    headers: {
      Accept: '*/*',
    },
  })

  if (!response.ok) {
    throw new Error('Could not load outstanding summary.')
  }

  const payload = (await response.json()) as unknown[]
  if (!Array.isArray(payload)) {
    throw new Error('Invalid outstanding summary response.')
  }

  return payload.map(mapOutstandingSummaryRow)
}

export const fetchOutstandingDashboard = async (
  branchCodes: string[],
): Promise<OutstandingDashboardKpi> => {
  const params = new URLSearchParams()
  for (const code of branchCodes) {
    const trimmed = code.trim()
    if (trimmed) {
      params.append('branchCode', trimmed)
    }
  }
  const query = params.toString()
  const url = query ? `${REPORTS_OUTSTANDING_DASHBOARD_URL}?${query}` : REPORTS_OUTSTANDING_DASHBOARD_URL

  const response = await authorizedFetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json, */*',
    },
  })

  if (!response.ok) {
    throw new Error('Could not load outstanding dashboard.')
  }

  const payload = (await response.json()) as OutstandingDashboardKpi
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid outstanding dashboard response.')
  }

  return payload
}

const parseFilenameFromContentDisposition = (header: string | null): string | null => {
  if (!header) {
    return null
  }
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim().replace(/["']/g, ''))
    } catch {
      return utf8[1].trim()
    }
  }
  const quoted = /filename="([^"]+)"/i.exec(header)
  if (quoted?.[1]) {
    return quoted[1]
  }
  const loose = /filename=([^;\s]+)/i.exec(header)
  return loose?.[1] ? loose[1].replace(/["']/g, '') : null
}

export type ReportExcelExportResult = {
  blob: Blob
  filename: string | null
}

export const fetchReportExcelExport = async (
  reportId: string,
  filters: ScopeFiltersState,
): Promise<ReportExcelExportResult> => {
  const params = buildOutstandingSummarySearchParams(filters)
  const query = params.toString()
  const base = reportExcelExportUrl(reportId)
  const url = query ? `${base}?${query}` : base

  const response = await authorizedFetch(url, {
    method: 'GET',
    headers: {
      Accept:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
    },
  })

  if (!response.ok) {
    let message = `Could not download report (${response.status}).`
    const contentType = response.headers.get('content-type') ?? ''
    try {
      if (contentType.includes('application/json')) {
        const payload = (await response.json()) as { detail?: unknown; message?: string }
        if (typeof payload.message === 'string') {
          message = payload.message
        } else if (payload.detail != null) {
          message =
            typeof payload.detail === 'string'
              ? payload.detail
              : JSON.stringify(payload.detail).slice(0, 300)
        }
      } else {
        const text = await response.text()
        if (text.trim()) {
          message = text.trim().slice(0, 300)
        }
      }
    } catch {
      /* keep default message */
    }
    throw new Error(message)
  }

  const blob = await response.blob()
  const filename = parseFilenameFromContentDisposition(response.headers.get('Content-Disposition'))
  return { blob, filename }
}
