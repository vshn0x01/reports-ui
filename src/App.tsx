
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import {
  ACCESS_TOKEN_STORAGE_KEY,
  clearAccessToken,
  fetchAuthMe,
  getAccessToken,
  loginWithApi,
  setAccessToken,
} from './api/auth'
import { fetchReportFilters } from './api/reportFilters'
import {
  fetchOutstandingDashboard,
  fetchOutstandingSummary,
  fetchReportExcelExport,
  fetchReports,
} from './api/reports'
import {
  branchCodesFromFilters,
  buildReportScopePayload,
  createEmptyScopeFilters,
  lookupScopeLabelInCatalog,
  orderedKeysFromCatalog,
  scopeDimensionLabel,
  type ScopeFiltersState,
} from './scope/reportScopes'
import type {
  DownloadEntry,
  OutstandingDashboardKpi,
  OutstandingSummaryRow,
  ReportFiltersCatalog,
  ReportListItem,
  UserProfile,
  UserRole,
} from './types'
import { DashboardKpiSummary } from './components/DashboardKpiSummary'
import 'react-day-picker/dist/style.css'
import './App.css'

const SESSION_STORAGE_KEY = 'reports-ui-session'
const DOWNLOAD_STORAGE_KEY = 'reports-ui-download-history'
const THEME_STORAGE_KEY = 'reports-ui-theme'

const roleLabels: Record<UserRole, string> = {
  operations: 'Operations',
  'central-ops': 'Central Ops',
  insurance: 'Insurance',
  finance: 'Finance',
}

const categoryLabels = {
  operations: 'Operations',
  collections: 'Collections',
  compliance: 'Compliance',
  finance: 'Finance',
}

type DateRangeFilterProps = {
  value: DateRange | undefined
  onChange: (nextValue: DateRange | undefined) => void
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(value)
}

function formatOutstandingAmount(value: number) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatCount(value: number) {
  return value.toLocaleString('en-IN')
}

function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', onOutsideClick)
    return () => window.removeEventListener('mousedown', onOutsideClick)
  }, [])

  const labelText = value?.from
    ? `${formatDate(value.from)}${value.to ? ` - ${formatDate(value.to)}` : ''}`
    : 'Select date range'

  return (
    <div className="custom-filter date-range-filter" ref={containerRef}>
      <button
        type="button"
        className={`filter-select-trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="filter-select-trigger-text">{labelText}</span>
        <span className="filter-select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen ? (
        <div className="date-range-popover">
          <DayPicker
            mode="range"
            selected={value}
            onSelect={onChange}
            showOutsideDays
            captionLayout="dropdown"
            fromYear={2020}
            toYear={2035}
          />
        </div>
      ) : null}
    </div>
  )
}

type SearchableFilterSelectProps = {
  label: string
  options: { value: string; label: string }[]
  selectedValues: string[]
  onToggleValue: (value: string) => void
}

function SearchableFilterSelect({
  label,
  options,
  selectedValues,
  onToggleValue,
}: SearchableFilterSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', onOutsideClick)
    return () => window.removeEventListener('mousedown', onOutsideClick)
  }, [])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
    }
  }, [isOpen])

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      return options
    }
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.value.includes(q),
    )
  }, [options, query])

  return (
    <div className="custom-filter searchable-filter-select" ref={containerRef}>
      <button
        type="button"
        className={`filter-select-trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
      >
        <span className="filter-select-trigger-text">
          {selectedValues.length > 0 ? `${selectedValues.length} selected` : label}
        </span>
        <span className="filter-select-arrow" aria-hidden="true">
          ▾
        </span>
      </button>
      {isOpen ? (
        <div className="filter-select-menu filter-select-menu--searchable">
          <input
            type="search"
            className="filter-select-search"
            placeholder="Search…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Search ${label}`}
          />
          <div className="filter-select-options" role="listbox" aria-label={label}>
            {filteredOptions.length === 0 ? (
              <p className="filter-select-empty">No matches</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`filter-option${isSelected ? ' is-selected' : ''}`}
                    onClick={() => onToggleValue(option.value)}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span>{option.label}</span>
                    {isSelected ? (
                      <span className="filter-option-check" aria-hidden="true">
                        ✓
                      </span>
                    ) : null}
                  </button>
                )
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type ReadOnlyScopeFieldProps = {
  label: string
  value: string
}

function ReadOnlyScopeField({ label, value }: ReadOnlyScopeFieldProps) {
  return (
    <div className="scope-filter-readonly">
      <input
        type="text"
        readOnly
        value={value}
        tabIndex={-1}
        aria-readonly="true"
        aria-label={label}
      />
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return storedTheme === 'dark' ? 'dark' : 'light'
  })
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(() => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    if (!accessToken) {
      return null
    }
    const session = localStorage.getItem(SESSION_STORAGE_KEY)
    return session ? (JSON.parse(session) as UserProfile) : null
  })
  const [history, setHistory] = useState<DownloadEntry[]>(() => {
    const rawHistory = localStorage.getItem(DOWNLOAD_STORAGE_KEY)
    return rawHistory ? (JSON.parse(rawHistory) as DownloadEntry[]) : []
  })
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [search, setSearch] = useState('')
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'reports' | 'recent-activity'>(
    'dashboard',
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [filters, setFilters] = useState<ScopeFiltersState>(() => createEmptyScopeFilters())
  const [reportFiltersCatalog, setReportFiltersCatalog] = useState<ReportFiltersCatalog | null>(null)
  const [reportFiltersLoading, setReportFiltersLoading] = useState(false)
  const [reportFiltersError, setReportFiltersError] = useState('')
  const [apiReports, setApiReports] = useState<ReportListItem[]>([])
  const [reportsLoading, setReportsLoading] = useState(false)
  const [reportsError, setReportsError] = useState('')
  const [outstandingSummaryRows, setOutstandingSummaryRows] = useState<OutstandingSummaryRow[]>([])
  const [outstandingSummaryLoading, setOutstandingSummaryLoading] = useState(false)
  const [outstandingSummaryError, setOutstandingSummaryError] = useState('')
  const [dashboardKpi, setDashboardKpi] = useState<OutstandingDashboardKpi | null>(null)
  const [dashboardKpiLoading, setDashboardKpiLoading] = useState(false)
  const [dashboardKpiError, setDashboardKpiError] = useState('')
  const [dashboardKpiRetryTick, setDashboardKpiRetryTick] = useState(0)
  const [welcomeNow, setWelcomeNow] = useState(() => new Date())

  useEffect(() => {
    if (activeSection !== 'dashboard') {
      return
    }
    const id = window.setInterval(() => setWelcomeNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [activeSection])

  const welcomeGreeting = useMemo(() => {
    const h = welcomeNow.getHours()
    if (h < 12) {
      return 'Good morning'
    }
    if (h < 17) {
      return 'Good afternoon'
    }
    return 'Good evening'
  }, [welcomeNow])

  const welcomeClockFormatted = useMemo(
    () =>
      welcomeNow.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      }),
    [welcomeNow],
  )

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    if (!sessionUser) {
      setApiReports([])
      setReportsError('')
      setReportsLoading(false)
      setReportFiltersCatalog(null)
      setReportFiltersError('')
      setReportFiltersLoading(false)
      setFilters(createEmptyScopeFilters())
      setDashboardKpi(null)
      setDashboardKpiError('')
      setDashboardKpiLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setReportsLoading(true)
      setReportsError('')
      setReportFiltersLoading(true)
      setReportFiltersError('')
      const results = await Promise.allSettled([fetchReports(), fetchReportFilters()])
      if (cancelled) {
        return
      }

      const [reportsResult, filtersResult] = results
      if (reportsResult.status === 'fulfilled') {
        setApiReports(reportsResult.value)
      } else {
        setApiReports([])
        setReportsError('Could not load reports. Please try again.')
      }

      if (filtersResult.status === 'fulfilled') {
        setReportFiltersCatalog(filtersResult.value)
      } else {
        setReportFiltersCatalog(null)
        setReportFiltersError('Could not load report filters. Please try again.')
      }

      setReportsLoading(false)
      setReportFiltersLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [sessionUser])

  useEffect(() => {
    if (!reportFiltersCatalog) {
      return
    }

    setFilters((previous) => {
      const next: ScopeFiltersState = { ...previous }
      for (const [key, items] of Object.entries(reportFiltersCatalog)) {
        if (!items?.length) {
          continue
        }
        if (items.length === 1) {
          next[key] = [String(items[0].id)]
        } else if (!(key in next)) {
          next[key] = []
        }
      }
      for (const key of Object.keys(next)) {
        if (!(key in reportFiltersCatalog)) {
          delete next[key]
        }
      }
      return next
    })
  }, [reportFiltersCatalog])

  useEffect(() => {
    if (activeSection !== 'reports') {
      setSelectedReportId(null)
      setDownloadError('')
    }
  }, [activeSection])

  const availableReports = useMemo(() => {
    if (!sessionUser) {
      return []
    }

    return apiReports.filter((report) => report.isActive)
  }, [sessionUser, apiReports])

  const filteredReports = useMemo(() => {
    const term = search.trim().toLowerCase()
    return availableReports.filter((report) => {
      if (!term) {
        return true
      }
      return (
        report.name.toLowerCase().includes(term) ||
        report.description.toLowerCase().includes(term) ||
        report.category.toLowerCase().includes(term)
      )
    })
  }, [availableReports, search])

  const selectedReport = useMemo(
    () => availableReports.find((report) => report.id === selectedReportId) ?? null,
    [availableReports, selectedReportId],
  )
  const isOutstandingReport = Boolean(
    selectedReport &&
      (selectedReport.code.toLowerCase().includes('outstanding') ||
        selectedReport.name.toLowerCase().includes('outstanding')),
  )

  useEffect(() => {
    if (isOutstandingReport && dateRange?.from) {
      setDateRange(undefined)
    }
  }, [isOutstandingReport, dateRange])

  useEffect(() => {
    if (!sessionUser || !isOutstandingReport || !selectedReportId) {
      setOutstandingSummaryRows([])
      setOutstandingSummaryError('')
      setOutstandingSummaryLoading(false)
      return
    }

    let cancelled = false
    void (async () => {
      setOutstandingSummaryLoading(true)
      setOutstandingSummaryError('')
      try {
        const rows = await fetchOutstandingSummary(filters)
        if (!cancelled) {
          setOutstandingSummaryRows(rows)
        }
      } catch {
        if (!cancelled) {
          setOutstandingSummaryRows([])
          setOutstandingSummaryError('Could not load outstanding summary. Please try again.')
        }
      } finally {
        if (!cancelled) {
          setOutstandingSummaryLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionUser, isOutstandingReport, selectedReportId, filters])

  useEffect(() => {
    if (!sessionUser || activeSection !== 'dashboard') {
      return
    }
    let cancelled = false
    void (async () => {
      setDashboardKpiLoading(true)
      setDashboardKpiError('')
      try {
        const codes = branchCodesFromFilters(filters, reportFiltersCatalog)
        const data = await fetchOutstandingDashboard(codes)
        if (!cancelled) {
          setDashboardKpi(data)
        }
      } catch {
        if (!cancelled) {
          setDashboardKpi(null)
          setDashboardKpiError('Could not load KPI snapshot for your scope.')
        }
      } finally {
        if (!cancelled) {
          setDashboardKpiLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionUser, activeSection, filters, reportFiltersCatalog, dashboardKpiRetryTick])

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsLoggingIn(true)
    setError('')
    try {
      const { accessToken } = await loginWithApi({
        username: username.trim(),
        password,
      })

      setAccessToken(accessToken)

      try {
        const profile = await fetchAuthMe()
        setSessionUser(profile)
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile))
      } catch {
        clearAccessToken()
        throw new Error('Could not load your profile. Please try again.')
      }
      setUsername('')
      setPassword('')
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : 'Unable to sign in. Please try again.'
      setError(message)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const logout = () => {
    setSessionUser(null)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    clearAccessToken()
    setSearch('')
    setDownloadError('')
    setSelectedReportId(null)
    setActiveSection('dashboard')
    setDateRange(undefined)
    setFilters(createEmptyScopeFilters())
    setReportFiltersCatalog(null)
    setReportFiltersError('')
    setReportFiltersLoading(false)
    setApiReports([])
    setReportsError('')
    setReportsLoading(false)
    setOutstandingSummaryRows([])
    setOutstandingSummaryError('')
    setOutstandingSummaryLoading(false)
    setDashboardKpi(null)
    setDashboardKpiError('')
    setDashboardKpiLoading(false)
  }

  const reloadReports = async () => {
    if (!getAccessToken()) {
      return
    }
    setReportsLoading(true)
    setReportsError('')
    try {
      setApiReports(await fetchReports())
    } catch {
      setApiReports([])
      setReportsError('Could not load reports. Please try again.')
    } finally {
      setReportsLoading(false)
    }
  }

  const lockedScopeKeys = useMemo(() => {
    if (!reportFiltersCatalog) {
      return new Set<string>()
    }
    const locked = new Set<string>()
    for (const [key, items] of Object.entries(reportFiltersCatalog)) {
      if (items?.length === 1) {
        locked.add(key)
      }
    }
    return locked
  }, [reportFiltersCatalog])

  const scopeKeysForUi = useMemo(() => {
    if (!reportFiltersCatalog) {
      return []
    }
    return orderedKeysFromCatalog(reportFiltersCatalog)
  }, [reportFiltersCatalog])

  const removeFilterValue = (field: string, value: string) => {
    if (lockedScopeKeys.has(field)) {
      return
    }
    setFilters((current) => ({
      ...current,
      [field]: (current[field] ?? []).filter((item) => item !== value),
    }))
  }

  const toggleFilterValue = (field: string, value: string) => {
    setFilters((current) => {
      const prev = current[field] ?? []
      const exists = prev.includes(value)
      return {
        ...current,
        [field]: exists ? prev.filter((item) => item !== value) : [...prev, value],
      }
    })
  }

  const downloadReport = async (reportId: string) => {
    if (!sessionUser) {
      return
    }
    const report = availableReports.find((item) => item.id === reportId)
    if (!report) {
      return
    }
    const scopePayload = buildReportScopePayload(filters)
    const hasScopeSelection = scopePayload.scopes.length > 0
    const hasDateSelection = !isOutstandingReport && Boolean(dateRange?.from)
    if (!hasScopeSelection && !hasDateSelection) {
      setDownloadError('Please choose at least one filter before downloading a report.')
      return
    }
    setDownloadError('')

    setDownloadingReportId(reportId)
    const time = new Date()
    const timestamp = time.getTime()

    try {
      const { blob, filename: serverFilename } = await fetchReportExcelExport(reportId, filters)
      const fallbackBase = `${report.name.replaceAll(/\s+/g, '-').toLowerCase()}-${timestamp}`
      const fromServer = serverFilename?.replace(/[/\\?%*:|"<>]/g, '_').trim()
      const baseName = fromServer && fromServer.length > 0 ? fromServer : `${fallbackBase}.xlsx`
      const downloadName = baseName.toLowerCase().endsWith('.xlsx') ? baseName : `${baseName}.xlsx`

      const fileUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = fileUrl
      link.download = downloadName
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(fileUrl)

      const newEntry: DownloadEntry = {
        id: `dl-${timestamp}`,
        reportId: report.id,
        reportName: report.name,
        downloadedAt: time.toISOString(),
        by: sessionUser.name,
      }

      const updatedHistory = [newEntry, ...history].slice(0, 12)
      setHistory(updatedHistory)
      localStorage.setItem(DOWNLOAD_STORAGE_KEY, JSON.stringify(updatedHistory))
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Could not download report. Please try again.'
      setDownloadError(message)
    } finally {
      setDownloadingReportId(null)
    }
  }

  if (!sessionUser) {
    return (
      <main className="shell login-shell">
        <div className="login-atmosphere" aria-hidden="true">
          <div className="login-orb login-orb--a" />
          <div className="login-orb login-orb--b" />
          <div className="login-orb login-orb--c" />
          <div className="login-mesh" />
          <div className="login-shine" />
        </div>

        <section className="login-card">
          <div className="login-card-accent" aria-hidden="true" />
          <div className="login-card-inner">
            <header className="login-brand">
              <div className="login-mark" aria-hidden="true">
                <img src="/login-brand-logo.png" alt="" className="login-mark__img" />
              </div>
              <h1>Prism Dashboard</h1>
              <p className="login-tagline">
                Sign in to access reports tailored to your role.
              </p>
            </header>

            <form className="login-form" onSubmit={login}>
              <label>
                Username
                <input
                  type="text"
                  value={username}
                  placeholder="Enter your username"
                  autoComplete="username"
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              {error ? <p className="error-text">{error}</p> : null}
              <button className="login-submit-btn" type="submit" disabled={isLoggingIn}>
                {isLoggingIn ? 'Signing in...' : 'Sign in'}
              </button>
              <div className="login-divider" role="separator" aria-orientation="horizontal">
                <span className="login-divider__line" aria-hidden="true" />
                <span className="login-divider__text">or</span>
                <span className="login-divider__line" aria-hidden="true" />
              </div>
              <button className="login-o365-btn" type="button">
                <span className="login-o365-btn__mark" aria-hidden="true">
                  <svg viewBox="0 0 21 21" width="16" height="16" focusable="false">
                    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                  </svg>
                </span>
                <span className="login-o365-btn__label">Login with O365</span>
              </button>
            </form>

            <p className="login-footnote">Use your organization credentials.</p>
          </div>
        </section>
      </main>
    )
  }

  const roleScopedHistory = history.filter((item) => item.by === sessionUser.name)
  const activeFilterCount = Object.values(filters).reduce((count, values) => count + values.length, 0)

  return (
    <main className="shell dashboard-shell">
      <div className="dashboard-atmosphere" aria-hidden="true">
        <div className="dashboard-glow dashboard-glow--one" />
        <div className="dashboard-glow dashboard-glow--two" />
      </div>
      <aside className="dashboard-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand-row">
            <img src="/prism-dashboard-logo.png" alt="" className="sidebar-brand-mark" />
            <h1 className="sidebar-brand">Prism</h1>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <button
            type="button"
            className={`sidebar-nav-item${activeSection === 'dashboard' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('dashboard')}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`sidebar-nav-item${activeSection === 'reports' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('reports')}
          >
            Reports Library
          </button>
          <button
            type="button"
            className={`sidebar-nav-item${activeSection === 'recent-activity' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('recent-activity')}
          >
            Recent Activity
          </button>
        </nav>
        <div className="sidebar-user">
          <p>{sessionUser.name}</p>
          <span className="sidebar-user-email">{sessionUser.email}</span>
          {sessionUser.department ? (
            <span className="sidebar-user-meta">{sessionUser.department}</span>
          ) : null}
          <span className="sidebar-user-meta">
            {sessionUser.roleName ?? roleLabels[sessionUser.role]}
            {sessionUser.scopeName ? ` • ${sessionUser.scopeName}` : ''}
          </span>
        </div>
        <label className="theme-switch" aria-label="Toggle dark mode">
          <span className="theme-switch-label">Theme</span>
          <input
            type="checkbox"
            checked={theme === 'dark'}
            onChange={() => setTheme((current) => (current === 'light' ? 'dark' : 'light'))}
          />
          <span className="theme-switch-track" aria-hidden="true">
            <span className="theme-switch-thumb" />
          </span>
        </label>
        <button className="secondary-btn sidebar-logout" type="button" onClick={logout}>
          Logout
        </button>
      </aside>

      <section className="glass-panel dashboard-panel">
        <header
          className={
            activeSection === 'dashboard'
              ? 'dashboard-header dashboard-header--hero'
              : 'dashboard-header'
          }
        >
          {activeSection === 'dashboard' ? (
            <div className="welcome-hero">
              <div className="welcome-hero-backdrop" aria-hidden="true" />
              <div className="welcome-hero-shimmer" aria-hidden="true" />
              <div className="welcome-hero-content">
                <p className="welcome-hero-lede">{welcomeGreeting}</p>
                <h2 className="welcome-hero-heading">
                  Welcome back, <span className="welcome-hero-name">{sessionUser.name}</span>
                </h2>
              </div>
              <div className="welcome-hero-aside">
                <span className="welcome-hero-clock-label">Local time</span>
                <time className="welcome-hero-clock" dateTime={welcomeNow.toISOString()}>
                  {welcomeClockFormatted}
                </time>
              </div>
            </div>
          ) : (
            <div>
              <h2>
                {activeSection === 'reports' ? 'Reports Library' : 'Recent Activity'}
              </h2>
            </div>
          )}
        </header>

        {activeSection === 'dashboard' ? (
          <section className="dashboard-overview">
            <section className="dashboard-section" aria-labelledby="dashboard-profile-heading">
              <header className="dashboard-section-header">
                <span className="dashboard-section-marker" aria-hidden="true" />
                <h3 id="dashboard-profile-heading" className="dashboard-section-title">
                  Profile
                </h3>
                <span className="dashboard-section-divider" role="presentation" />
              </header>
              <div className="dashboard-user-card">
                <dl className="dashboard-user-details">
                  <div>
                    <dt>Full name</dt>
                    <dd>{sessionUser.name ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Username</dt>
                    <dd>{sessionUser.username ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{sessionUser.email}</dd>
                  </div>
                  {sessionUser.department ? (
                    <div>
                      <dt>Department</dt>
                      <dd>{sessionUser.department}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Role</dt>
                    <dd>{sessionUser.roleName ?? roleLabels[sessionUser.role]}</dd>
                  </div>
                  <div>
                    <dt>Scope</dt>
                    <dd>{sessionUser.scopeName ?? '—'}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="dashboard-section" aria-labelledby="dashboard-summary-heading">
              <header className="dashboard-section-header">
                <span className="dashboard-section-marker" aria-hidden="true" />
                <h3 id="dashboard-summary-heading" className="dashboard-section-title">
                  Summary
                </h3>
                <span className="dashboard-section-divider" role="presentation" />
              </header>
              <DashboardKpiSummary
                kpi={dashboardKpi}
                branchCodesSent={branchCodesFromFilters(filters, reportFiltersCatalog)}
                loading={dashboardKpiLoading}
                error={dashboardKpiError}
                onRetry={() => setDashboardKpiRetryTick((n) => n + 1)}
              />
            </section>
          </section>
        ) : activeSection === 'reports' ? (
          <>
            <section className="toolbar">
              <label>
                Search reports
                <input
                  type="search"
                  value={search}
                  placeholder="Outstanding, Collection, Disbursement..."
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
            </section>

            <section className="reports-list-panel">
              {reportsLoading ? (
                <p className="reports-loading-hint" role="status">
                  Loading reports…
                </p>
              ) : reportsError ? (
                <article className="empty-state">
                  <h3>Could not load reports</h3>
                  <p>{reportsError}</p>
                  <button type="button" className="secondary-btn reports-retry-btn" onClick={() => void reloadReports()}>
                    Retry
                  </button>
                </article>
              ) : availableReports.length === 0 ? (
                <article className="empty-state">
                  <h3>No reports available</h3>
                  <p>There are no active reports assigned to your account right now.</p>
                </article>
              ) : filteredReports.length === 0 ? (
                <article className="empty-state">
                  <h3>No matching reports</h3>
                  <p>Try a different search term to discover accessible reports.</p>
                </article>
              ) : (
                <div className="report-card-grid">
                  {filteredReports.map((report) => (
                    <article
                      className="report-card"
                      key={report.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedReportId(report.id)
                        setDownloadError('')
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedReportId(report.id)
                          setDownloadError('')
                        }
                      }}
                    >
                      <span className="report-open-btn" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                          <path
                            d="M9 6L15 12L9 18"
                            stroke="currentColor"
                            strokeWidth="1.9"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <p className="report-card-category">{categoryLabels[report.category]}</p>
                      <h3>{report.name}</h3>
                    </article>
                  ))}
                </div>
              )}
            </section>

          </>
        ) : (
          <section className="reports-list-panel">
            {roleScopedHistory.length === 0 ? (
              <article className="empty-state">
                <h3>No recent activity</h3>
                <p>Your downloads will appear here after you download reports.</p>
              </article>
            ) : (
              <div className="reports-list-wrap">
                <table className="reports-list">
                  <thead>
                    <tr>
                      <th>Report</th>
                      <th>Downloaded At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleScopedHistory.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <strong>{entry.reportName}</strong>
                        </td>
                        <td>{new Date(entry.downloadedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

      </section>
      {activeSection === 'reports' ? (
        <aside className={`report-drawer${selectedReport ? ' is-open' : ''}`} aria-hidden={!selectedReport}>
          {selectedReport ? (
            <>
              <div className="report-drawer-header">
                <div>
                  <p className="eyebrow">Report Summary</p>
                  <h3>{selectedReport.name}</h3>
                </div>
                <button
                  type="button"
                  className="report-drawer-close"
                  onClick={() => {
                    setSelectedReportId(null)
                    setDownloadError('')
                  }}
                  aria-label="Close report panel"
                  title="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path
                      d="M7 7L17 17M17 7L7 17"
                      stroke="currentColor"
                      strokeWidth="1.9"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <section className="filters-panel report-drawer-filters">
                <h4>Filter your search</h4>
                <div className="filters-grid">
                  {reportFiltersLoading ? (
                    <p className="reports-loading-hint filters-loading-span" role="status">
                      Loading filters…
                    </p>
                  ) : reportFiltersError ? (
                    <p className="error-text filters-error-span">{reportFiltersError}</p>
                  ) : scopeKeysForUi.length === 0 ? (
                    <p className="filters-empty-hint">No scope filters are available for your account.</p>
                  ) : (
                    <>
                      {scopeKeysForUi.map((key) => {
                        const items = reportFiltersCatalog![key]
                        const label = scopeDimensionLabel(key)
                        if (items.length === 1) {
                          return (
                            <div key={key}>
                              <ReadOnlyScopeField label={label} value={items[0].name} />
                            </div>
                          )
                        }
                        return (
                          <label key={key}>
                            <SearchableFilterSelect
                              label={label}
                              options={items.map((item) => ({
                                value: String(item.id),
                                label: item.name,
                              }))}
                              selectedValues={filters[key] ?? []}
                              onToggleValue={(value) => toggleFilterValue(key, value)}
                            />
                          </label>
                        )
                      })}
                      {!isOutstandingReport ? (
                        <label className="date-range-cell">
                          <DateRangeFilter value={dateRange} onChange={setDateRange} />
                        </label>
                      ) : null}
                    </>
                  )}
                </div>
                <div className="selected-badges">
                  {scopeKeysForUi.flatMap((field) =>
                    (filters[field] ?? []).map((value) => {
                      const dimLabel = scopeDimensionLabel(field)
                      const text = lookupScopeLabelInCatalog(reportFiltersCatalog, field, value)
                      if (lockedScopeKeys.has(field)) {
                        return (
                          <span key={`${field}-${value}`} className="filter-badge filter-badge--locked">
                            <span>{`${dimLabel}: ${text}`}</span>
                          </span>
                        )
                      }
                      return (
                        <button
                          key={`${field}-${value}`}
                          type="button"
                          className="filter-badge"
                          onClick={() => removeFilterValue(field, value)}
                          aria-label={`Remove ${text} from ${dimLabel}`}
                        >
                          <span>{`${dimLabel}: ${text}`}</span>
                          <span className="badge-close" aria-hidden="true">
                            x
                          </span>
                        </button>
                      )
                    }),
                  )}
                  {!isOutstandingReport && dateRange?.from ? (
                    <button
                      type="button"
                      className="filter-badge"
                      onClick={() => setDateRange(undefined)}
                      aria-label="Remove date range filter"
                    >
                      <span>
                        {`Date: ${formatDate(dateRange.from)}${dateRange.to ? ` - ${formatDate(dateRange.to)}` : ''}`}
                      </span>
                      <span className="badge-close" aria-hidden="true">
                        x
                      </span>
                    </button>
                  ) : null}
                </div>
              </section>

              <section className="reports-list-panel report-summary-table-panel">
                {isOutstandingReport ? (
                  outstandingSummaryLoading ? (
                    <p className="reports-loading-hint" role="status">
                      Loading summary…
                    </p>
                  ) : outstandingSummaryError ? (
                    <p className="error-text">{outstandingSummaryError}</p>
                  ) : outstandingSummaryRows.length === 0 ? (
                    <p className="filters-empty-hint">No outstanding summary rows for the current scope.</p>
                  ) : (
                    <table className="reports-list report-summary-table report-summary-table--outstanding">
                      <thead>
                        <tr>
                          <th>Branch ID</th>
                          <th>Branch Name</th>
                          <th>Loans</th>
                          <th>Outstanding</th>
                          <th>OD Loans</th>
                          <th>OD Outstanding</th>
                        </tr>
                      </thead>
                      <tbody>
                        {outstandingSummaryRows.map((row) => (
                          <tr key={`${row.branch_id}-${row.branch_name}`}>
                            <td>{row.branch_id}</td>
                            <td>{row.branch_name}</td>
                            <td>{formatCount(row.loans)}</td>
                            <td>{formatOutstandingAmount(row.outstanding)}</td>
                            <td>{formatCount(row.od_loans)}</td>
                            <td>{formatOutstandingAmount(row.od_amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  <table className="reports-list report-summary-table">
                    <tbody>
                      <tr>
                        <th>Category</th>
                        <td>{categoryLabels[selectedReport.category]}</td>
                      </tr>
                      <tr>
                        <th>Cadence</th>
                        <td>{selectedReport.cadence}</td>
                      </tr>
                      <tr>
                        <th>Format</th>
                        <td>{selectedReport.format}</td>
                      </tr>
                      <tr>
                        <th>Applied Filters</th>
                        <td>{activeFilterCount + (!isOutstandingReport && dateRange?.from ? 1 : 0)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>
              {downloadError ? <p className="error-text">{downloadError}</p> : null}
              <button
                type="button"
                className="report-drawer-download-btn"
                onClick={() => void downloadReport(selectedReport.id)}
                disabled={downloadingReportId === selectedReport.id}
              >
                {downloadingReportId === selectedReport.id ? 'Preparing report...' : 'Download report'}
              </button>
            </>
          ) : null}
        </aside>
      ) : null}
    </main>
  )
}

export default App
