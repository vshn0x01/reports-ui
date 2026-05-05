import { REPORTS_FILTERS_URL } from '../config/variables'
import type { ReportFiltersCatalog } from '../types'
import { authorizedFetch } from './auth'

export const fetchReportFilters = async (): Promise<ReportFiltersCatalog> => {
  const response = await authorizedFetch(REPORTS_FILTERS_URL, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error('Could not load report filters.')
  }

  const payload = (await response.json()) as ReportFiltersCatalog
  if (!payload || typeof payload !== 'object') {
    throw new Error('Invalid report filters response.')
  }

  return payload
}
