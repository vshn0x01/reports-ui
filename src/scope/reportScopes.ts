import type { ReportFiltersCatalog } from '../types'

export const SCOPE_DIMENSION_ORDER = ['sbu', 'region', 'zone', 'cluster', 'unit', 'branch'] as const

export type ScopeFiltersState = Record<string, string[]>

export const scopeDimensionLabel = (key: string) => {
  const map: Record<string, string> = {
    sbu: 'SBU',
    region: 'Region',
    zone: 'Zone',
    cluster: 'Cluster',
    unit: 'Unit',
    branch: 'Branch',
  }
  return map[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Stable column order: known dimensions first, then any other keys from the API. */
export const orderedKeysFromCatalog = (catalog: ReportFiltersCatalog): string[] => {
  const keys = Object.keys(catalog).filter((k) => (catalog[k]?.length ?? 0) > 0)
  const knownSet = new Set<string>([...SCOPE_DIMENSION_ORDER])
  const ordered = SCOPE_DIMENSION_ORDER.filter((k) => keys.includes(k))
  const extras = keys.filter((k) => !knownSet.has(k)).sort()
  return [...ordered, ...extras]
}

export const buildReportScopePayload = (filters: ScopeFiltersState) => {
  const scopes: { scope_type: string; scope_id: number }[] = []
  for (const [scope_type, ids] of Object.entries(filters)) {
    for (const idStr of ids) {
      const scope_id = Number.parseInt(idStr, 10)
      if (!Number.isFinite(scope_id)) {
        continue
      }
      scopes.push({ scope_type, scope_id })
    }
  }
  return { scopes }
}

export const lookupScopeLabelInCatalog = (
  catalog: ReportFiltersCatalog | null,
  scopeKey: string,
  idStr: string,
): string => {
  if (!catalog) {
    return idStr
  }
  const items = catalog[scopeKey]
  if (!items?.length) {
    return idStr
  }
  const id = Number.parseInt(idStr, 10)
  return items.find((x) => x.id === id)?.name ?? idStr
}

export const createEmptyScopeFilters = (): ScopeFiltersState => ({})

/** Branch `code` values (e.g. IN0012554) for selected branch ids in filters, in selection order. */
export const branchCodesFromFilters = (
  filters: ScopeFiltersState,
  catalog: ReportFiltersCatalog | null,
): string[] => {
  const items = catalog?.branch
  if (!items?.length) {
    return []
  }
  const byId = new Map<number, string>()
  for (const opt of items) {
    if (opt.code) {
      byId.set(opt.id, opt.code)
    }
  }
  const codes: string[] = []
  for (const idStr of filters.branch ?? []) {
    const id = Number.parseInt(idStr, 10)
    if (!Number.isFinite(id)) {
      continue
    }
    const code = byId.get(id)
    if (code) {
      codes.push(code)
    }
  }
  return codes
}

/** Query keys for GET /reports/outstanding/summary (e.g. sbuId=1&zoneId=2). */
export const scopeKeyToOutstandingSummaryQueryKey = (scopeKey: string): string => {
  const map: Record<string, string> = {
    sbu: 'sbuId',
    zone: 'zoneId',
    region: 'regionId',
    cluster: 'clusterId',
    unit: 'unitId',
    branch: 'branchId',
  }
  return map[scopeKey] ?? `${scopeKey}Id`
}

/** Builds URLSearchParams; repeats keys when multiple ids are selected for one dimension. */
export const buildOutstandingSummarySearchParams = (filters: ScopeFiltersState): URLSearchParams => {
  const params = new URLSearchParams()
  for (const [scopeKey, idStrings] of Object.entries(filters)) {
    const queryKey = scopeKeyToOutstandingSummaryQueryKey(scopeKey)
    for (const idStr of idStrings) {
      const id = Number.parseInt(idStr, 10)
      if (!Number.isFinite(id)) {
        continue
      }
      params.append(queryKey, String(id))
    }
  }
  return params
}
