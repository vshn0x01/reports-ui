
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { DayPicker } from 'react-day-picker'
import type { DateRange } from 'react-day-picker'
import { reports, users } from './data'
import type { DownloadEntry, UserProfile, UserRole } from './types'
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

type ReportFilters = {
  sbu: string[]
  zone: string[]
  cluster: string[]
  unit: string[]
  branch: string[]
}

const filterOptions: Record<keyof ReportFilters, string[]> = {
  sbu: ['Retail Lending', 'SME Lending', 'Corporate Lending', 'Digital'],
  zone: ['North', 'South', 'East', 'West', 'Central'],
  cluster: ['Metro 1', 'Metro 2', 'Urban 1', 'Urban 2', 'Rural'],
  unit: ['Collections', 'Disbursement', 'Risk Control', 'Operations Desk'],
  branch: ['Mumbai', 'Delhi', 'Bengaluru', 'Chennai', 'Hyderabad', 'Pune'],
}

const filterFieldLabels: Record<keyof ReportFilters, string> = {
  sbu: 'SBU',
  zone: 'Zone',
  cluster: 'Cluster',
  unit: 'Unit',
  branch: 'Branch',
}

type FilterSelectProps = {
  label: string
  options: string[]
  selectedValues: string[]
  onToggleValue: (value: string) => void
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

function FilterSelect({ label, options, selectedValues, onToggleValue }: FilterSelectProps) {
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

  return (
    <div className="custom-filter" ref={containerRef}>
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
        <div className="filter-select-menu" role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = selectedValues.includes(option)
            return (
              <button
                key={option}
                type="button"
                className={`filter-option${isSelected ? ' is-selected' : ''}`}
                onClick={() => onToggleValue(option)}
                role="option"
                aria-selected={isSelected}
              >
                <span>{option}</span>
                {isSelected ? (
                  <span className="filter-option-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    return storedTheme === 'dark' ? 'dark' : 'light'
  })
  const [sessionUser, setSessionUser] = useState<UserProfile | null>(() => {
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
  const [search, setSearch] = useState('')
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'reports' | 'recent-activity'>(
    'dashboard',
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [filters, setFilters] = useState<ReportFilters>({
    sbu: [],
    zone: [],
    cluster: [],
    unit: [],
    branch: [],
  })

  useEffect(() => {
    document.body.classList.toggle('theme-dark', theme === 'dark')
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

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

    return reports.filter((report) => report.allowedRoles.includes(sessionUser.role))
  }, [sessionUser])

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
  const isOutstandingReport = selectedReport?.id === 'rpt-outstanding'

  useEffect(() => {
    if (isOutstandingReport && dateRange?.from) {
      setDateRange(undefined)
    }
  }, [isOutstandingReport, dateRange])

  const login = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const matchedUser = users.find(
      (candidate) =>
        candidate.username === username.trim().toLowerCase() && candidate.password === password,
    )

    if (!matchedUser) {
      setError('Invalid username or password.')
      return
    }

    const profile: UserProfile = {
      id: matchedUser.id,
      name: matchedUser.name,
      email: matchedUser.email,
      role: matchedUser.role,
    }
    setSessionUser(profile)
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile))
    setError('')
    setUsername('')
    setPassword('')
  }

  const logout = () => {
    setSessionUser(null)
    localStorage.removeItem(SESSION_STORAGE_KEY)
    setSearch('')
    setDownloadError('')
    setSelectedReportId(null)
    setActiveSection('dashboard')
    setDateRange(undefined)
    setFilters({
      sbu: [],
      zone: [],
      cluster: [],
      unit: [],
      branch: [],
    })
  }

  const removeFilterValue = (field: keyof ReportFilters, value: string) => {
    setFilters((current) => ({
      ...current,
      [field]: current[field].filter((item) => item !== value),
    }))
  }

  const toggleFilterValue = (field: keyof ReportFilters, value: string) => {
    setFilters((current) => {
      const exists = current[field].includes(value)
      return {
        ...current,
        [field]: exists ? current[field].filter((item) => item !== value) : [...current[field], value],
      }
    })
  }

  const downloadReport = async (reportId: string) => {
    if (!sessionUser) {
      return
    }
    const report = reports.find((item) => item.id === reportId)
    if (!report) {
      return
    }
    const hasAnyFilter =
      Object.values(filters).some((values) => values.length > 0) || Boolean(dateRange?.from)
    if (!hasAnyFilter) {
      setDownloadError('Please choose at least one filter before downloading a report.')
      return
    }
    setDownloadError('')

    setDownloadingReportId(reportId)
    await new Promise((resolve) => setTimeout(resolve, 600))

    const time = new Date()
    const timestamp = time.getTime()
    const csvContent = [
      `Report Name,${report.name}`,
      `Generated By,${sessionUser.name}`,
      `Role,${roleLabels[sessionUser.role]}`,
      `Generated At,${time.toISOString()}`,
      `SBU,${filters.sbu.length > 0 ? filters.sbu.join(' | ') : 'All'}`,
      `Zone,${filters.zone.length > 0 ? filters.zone.join(' | ') : 'All'}`,
      `Cluster,${filters.cluster.length > 0 ? filters.cluster.join(' | ') : 'All'}`,
      `Unit,${filters.unit.length > 0 ? filters.unit.join(' | ') : 'All'}`,
      `Branch,${filters.branch.length > 0 ? filters.branch.join(' | ') : 'All'}`,
      `Date Range,${dateRange?.from ? `${formatDate(dateRange.from)}${dateRange.to ? ` - ${formatDate(dateRange.to)}` : ''}` : 'All'}`,
      '',
      'Sample Data Row',
      'This is a placeholder file,connect this flow to backend API.',
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const fileUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = fileUrl
    link.download = `${report.name.replaceAll(/\s+/g, '-').toLowerCase()}-${timestamp}.csv`
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
    setDownloadingReportId(null)
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
                <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M8 26L20 8L32 26H8Z"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path
                    d="M14 26L20 16L26 26"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.85"
                  />
                  <path
                    d="M20 8V16"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    opacity="0.85"
                  />
                </svg>
              </div>
              <h1>Prism</h1>
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
              <button className="login-submit-btn" type="submit">
                Sign in
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
  const dashboardCards = [
    { label: 'No. of Loans', value: 12480 },
    { label: 'No of Customers', value: 8920 },
    { label: 'Regular Loans', value: 7435 },
    { label: 'OD Loans', value: 5045 },
    { label: 'Outstanding', value: 386200000 },
  ] as const

  return (
    <main className="shell dashboard-shell">
      <div className="dashboard-atmosphere" aria-hidden="true">
        <div className="dashboard-glow dashboard-glow--one" />
        <div className="dashboard-glow dashboard-glow--two" />
      </div>
      <aside className="dashboard-sidebar">
        <div className="sidebar-top">
          <h1 className="sidebar-brand">Prism</h1>
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
          <span>
            {roleLabels[sessionUser.role]} • {sessionUser.email}
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
        <header className="dashboard-header">
          <div>
            <h2>
              {activeSection === 'dashboard'
                ? `Welcome Back, ${sessionUser.name}`
                : activeSection === 'reports'
                  ? 'Reports Library'
                  : 'Recent Activity'}
            </h2>
          </div>
        </header>

        {activeSection === 'dashboard' ? (
          <section className="dashboard-overview">
            <div className="stats-grid">
              {dashboardCards.map((card) => (
                <article key={card.label}>
                  <p>{card.label}</p>
                  <strong>{card.value.toLocaleString('en-IN')}</strong>
                </article>
              ))}
            </div>
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
              {filteredReports.length === 0 ? (
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
                  <label>
                    <FilterSelect
                      label="SBU"
                      options={filterOptions.sbu}
                      selectedValues={filters.sbu}
                      onToggleValue={(value) => toggleFilterValue('sbu', value)}
                    />
                  </label>
                  <label>
                    <FilterSelect
                      label="Zone"
                      options={filterOptions.zone}
                      selectedValues={filters.zone}
                      onToggleValue={(value) => toggleFilterValue('zone', value)}
                    />
                  </label>
                  <label>
                    <FilterSelect
                      label="Cluster"
                      options={filterOptions.cluster}
                      selectedValues={filters.cluster}
                      onToggleValue={(value) => toggleFilterValue('cluster', value)}
                    />
                  </label>
                  <label>
                    <FilterSelect
                      label="Unit"
                      options={filterOptions.unit}
                      selectedValues={filters.unit}
                      onToggleValue={(value) => toggleFilterValue('unit', value)}
                    />
                  </label>
                  <label>
                    <FilterSelect
                      label="Branch"
                      options={filterOptions.branch}
                      selectedValues={filters.branch}
                      onToggleValue={(value) => toggleFilterValue('branch', value)}
                    />
                  </label>
                  {!isOutstandingReport ? (
                    <label className="date-range-cell">
                      <DateRangeFilter value={dateRange} onChange={setDateRange} />
                    </label>
                  ) : null}
                </div>
                <div className="selected-badges">
                  {(Object.keys(filters) as (keyof ReportFilters)[]).flatMap((field) =>
                    filters[field].map((value) => (
                      <button
                        key={`${field}-${value}`}
                        type="button"
                        className="filter-badge"
                        onClick={() => removeFilterValue(field, value)}
                        aria-label={`Remove ${value} from ${filterFieldLabels[field]}`}
                      >
                        <span>{`${filterFieldLabels[field]}: ${value}`}</span>
                        <span className="badge-close" aria-hidden="true">
                          x
                        </span>
                      </button>
                    )),
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
                      <tr>
                        <td>BR-001</td>
                        <td>Mumbai Central</td>
                        <td>342</td>
                        <td>12,450,000</td>
                        <td>86</td>
                        <td>3,180,000</td>
                      </tr>
                    </tbody>
                  </table>
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
