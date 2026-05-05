import type { OutstandingDashboardKpi } from '../types'

export type DashboardKpiSummaryProps = {
  kpi: OutstandingDashboardKpi | null
  /** Branch codes included in the API request (for context line). */
  branchCodesSent: string[]
  loading: boolean
  error: string
  onRetry?: () => void
}

function formatINRCompact(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e7) {
    return `₹${(value / 1e7).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Cr`
  }
  if (abs >= 1e5) {
    return `₹${(value / 1e5).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L`
  }
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatInteger(value: number): string {
  return Math.round(value).toLocaleString('en-IN')
}

function formatPct(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(1) : '—'}%`
}

export function DashboardKpiSummary({
  kpi,
  branchCodesSent,
  loading,
  error,
  onRetry,
}: DashboardKpiSummaryProps) {
  if (loading) {
    return (
      <div className="dashboard-kpi-root dashboard-kpi-root--loading" aria-busy="true">
        <div className="dashboard-kpi-cards">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="kpi-stat-card kpi-stat-card--skeleton">
              <span className="kpi-skeleton kpi-skeleton--icon" />
              <span className="kpi-skeleton kpi-skeleton--line" />
              <span className="kpi-skeleton kpi-skeleton--value" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dashboard-kpi-error">
        <p className="dashboard-kpi-error-text">{error}</p>
        {onRetry ? (
          <button type="button" className="secondary-btn dashboard-kpi-retry" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    )
  }

  if (!kpi) {
    return (
      <div className="dashboard-kpi-error">
        <p className="dashboard-kpi-error-text">No KPI data available.</p>
        {onRetry ? (
          <button type="button" className="secondary-btn dashboard-kpi-retry" onClick={onRetry}>
            Retry
          </button>
        ) : null}
      </div>
    )
  }

  const branchMeta =
    branchCodesSent.length === 0
      ? 'Full scope (no branch filter in request)'
      : branchCodesSent.length === 1
        ? `Branch ${branchCodesSent[0]}`
        : `${branchCodesSent.length} branches: ${branchCodesSent.slice(0, 3).join(', ')}${
            branchCodesSent.length > 3 ? '…' : ''
          }`

  return (
    <div className="dashboard-kpi-root">
      <p className="dashboard-kpi-lede">
        Outstanding portfolio snapshot
        <span className="dashboard-kpi-lede-meta"> · {branchMeta}</span>
      </p>

      <div className="dashboard-kpi-cards">
        <article className="kpi-stat-card kpi-stat-card--loans">
          <div className="kpi-stat-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4 19V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2z" strokeLinejoin="round" />
              <path d="M14 3v4h4M8 11h8M8 15h5" strokeLinecap="round" />
            </svg>
          </div>
          <p className="kpi-stat-card-label">Total loans</p>
          <p className="kpi-stat-card-value">{formatInteger(kpi.total_loans)}</p>
          <p className="kpi-stat-card-hint">Regular share {formatPct(kpi.pct_regular_loans)}</p>
        </article>

        <article className="kpi-stat-card kpi-stat-card--regular">
          <div className="kpi-stat-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 3v18M8 7l4-4 4 4M8 17l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="kpi-stat-card-label">Regular loans</p>
          <p className="kpi-stat-card-value">{formatInteger(kpi.regular_loans)}</p>
          <p className="kpi-stat-card-hint">{formatPct(kpi.pct_regular_loans)} of portfolio</p>
        </article>

        <article className="kpi-stat-card kpi-stat-card--od">
          <div className="kpi-stat-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 9v4M12 17h.01M10.3 3.6L3 21h18l-7.3-17.4a1 1 0 00-1.9 0z" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="kpi-stat-card-label">OD loans</p>
          <p className="kpi-stat-card-value">{formatInteger(kpi.od_loans)}</p>
          <p className="kpi-stat-card-hint">OD exposure {formatPct(kpi.pct_od_loans)}</p>
        </article>

        <article className="kpi-stat-card kpi-stat-card--outstanding">
          <div className="kpi-stat-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M12 2v20M17 7H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
            </svg>
          </div>
          <p className="kpi-stat-card-label">Total outstanding</p>
          <p className="kpi-stat-card-value kpi-stat-card-value--currency">
            {formatINRCompact(kpi.total_outstanding)}
          </p>
          <p className="kpi-stat-card-hint">
            {formatPct(kpi.pct_od_exposure)} of OD Loans
          </p>
        </article>

        <article className="kpi-stat-card kpi-stat-card--fiod">
          <div className="kpi-stat-card-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path
                d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <p className="kpi-stat-card-label">FIOD</p>
          <p className="kpi-stat-card-value kpi-stat-card-value--fiod">{formatInteger(kpi.fiod)}</p>
          <p className="kpi-stat-card-hint">
            {kpi.od_loans > 0
              ? `${((kpi.fiod / kpi.od_loans) * 100).toFixed(1)}% of OD loans`
              : '—'}
          </p>
        </article>
      </div>
    </div>
  )
}
