import React, { useEffect, useMemo, useState } from 'react';
import './Dashboard.css';

type Company = {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  role?: string;
};

type Investment = {
  _id?: string;
  date: string;
  company: string;
  assetType: string;
  amount: number;
  rate: number;
  durationMonths: number;
  status: string;
};

type Transaction = {
  _id?: string;
  date: string;
  company: string;
  type: string;
  amount: number;
  description?: string;
};

type User = {
  role?: string;
  isAdmin?: boolean;
  email?: string;
  fullName?: string;
};

type Props = {
  currentCompany: string;
  companies: Company[];
  onCompanySwitch: (company: string) => void;
  onSelectCompany?: (company: string) => void;
  user: User | null;
  viewMode: 'single' | 'consolidated';
};

const formatCurrency = (value: number) => {
  // Use Ethiopian Birr (ETB)
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'ETB', maximumFractionDigits: 0 }).format(value);
};

const getMaturityDate = (investment: Investment) => {
  const date = new Date(investment.date);
  const months = Number(investment.durationMonths || 0);
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

const getDaysUntil = (date: Date) => {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function Dashboard({ currentCompany, companies, onCompanySwitch, onSelectCompany, user, viewMode }: Props) {
  const isAdmin = Boolean(user?.isAdmin || (user?.role && user.role.toLowerCase() === 'admin'));
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCompany = viewMode === 'single' ? currentCompany : '';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const companyQuery = viewMode === 'single' && activeCompany ? `?company=${encodeURIComponent(activeCompany)}` : '';
        const [investRes, txRes] = await Promise.all([
          fetch(`/api/investments${companyQuery}`),
          fetch(`/api/transactions${companyQuery}`)
        ]);

        if (!investRes.ok) throw new Error('Failed to load investments');
        if (!txRes.ok) throw new Error('Failed to load transactions');

        const investData = await investRes.json();
        const txData = await txRes.json();

        setInvestments(Array.isArray(investData) ? investData : []);
        setTransactions(Array.isArray(txData) ? txData : []);
      } catch (err: any) {
        console.error(err);
        setError(err?.message || 'Unable to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeCompany, viewMode]);

  const summary = useMemo(() => {
    const totalInvestment = investments.reduce((sum, inv) => sum + (inv.amount || 0), 0);
    const totalProfitLoss = investments.reduce((sum, inv) => {
      // simple profit formula: amount * rate% * durationYears
      const durationYears = (inv.durationMonths || 0) / 12;
      return sum + (inv.amount || 0) * ((inv.rate || 0) / 100) * durationYears;
    }, 0);
    const activeAssets = investments.filter((inv) => inv.status?.toLowerCase() === 'active').length;

    const upcoming = investments
      .map((inv) => ({
        inv,
        maturity: getMaturityDate(inv)
      }))
      .filter(({ maturity }) => {
        const days = getDaysUntil(maturity);
        return days >= 0 && days <= 30;
      })
      .sort((a, b) => a.maturity.getTime() - b.maturity.getTime());

    return {
      totalInvestment,
      totalProfitLoss,
      activeAssets,
      upcomingMaturities: upcoming
    };
  }, [investments]);

  const perCompanySummary = useMemo(() => {
    const map: Record<
      string,
      {
        totalInvestment: number;
        totalProfitLoss: number;
        activeAssets: number;
        upcomingMaturities: number;
      }
    > = {};

    investments.forEach((inv) => {
      const company = inv.company || 'Unknown';
      if (!map[company]) {
        map[company] = {
          totalInvestment: 0,
          totalProfitLoss: 0,
          activeAssets: 0,
          upcomingMaturities: 0
        };
      }
      const entry = map[company];
      entry.totalInvestment += inv.amount || 0;
      const durationYears = (inv.durationMonths || 0) / 12;
      entry.totalProfitLoss += (inv.amount || 0) * ((inv.rate || 0) / 100) * durationYears;
      if (inv.status?.toLowerCase() === 'active') entry.activeAssets += 1;
      const maturity = getMaturityDate(inv);
      const days = getDaysUntil(maturity);
      if (days >= 0 && days <= 30) entry.upcomingMaturities += 1;
    });

    return Object.entries(map).map(([company, data]) => ({ company, ...data }));
  }, [investments]);

  const allocation = useMemo(() => {
    const palette = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#14b8a6', '#8b5cf6', '#e11d48'];
    const byType: Record<string, number> = {};
    investments.forEach((inv) => {
      const key = inv.assetType || 'Other';
      byType[key] = (byType[key] || 0) + (inv.amount || 0);
    });

    const total = Object.values(byType).reduce((sum, v) => sum + v, 0);
    const entries = Object.entries(byType).map(([type, value], idx) => ({
      type,
      value,
      percent: total ? (value / total) * 100 : 0,
      color: palette[idx % palette.length]
    }));
    return { entries, total };
  }, [investments]);

  const chartData = useMemo(() => {
    const now = new Date();
    const months: { label: string; value: number; profit: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: d.toLocaleString(undefined, { month: 'short' }), value: 0, profit: 0 });
    }
    const monthKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}`;
    const monthIndex: Record<string, number> = {};
    months.forEach((m, idx) => {
      const [monthName] = m.label.split(' ');
      const date = new Date();
      const parts = m.label;
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - idx), 1);
      monthIndex[monthKey(d)] = idx;
    });

    investments.forEach((inv) => {
      const date = new Date(inv.date);
      const key = monthKey(date);
      const idx = monthIndex[key];
      if (idx === undefined) return;
      months[idx].value += inv.amount || 0;
      const durationYears = (inv.durationMonths || 0) / 12;
      months[idx].profit += (inv.amount || 0) * ((inv.rate || 0) / 100) * durationYears;
    });

    return months;
  }, [investments]);

  const linePath = (values: number[]) => {
    if (!values.length) return '';
    const width = 260;
    const height = 120;
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;

    return values
      .map((value, idx) => {
        const x = (idx / (values.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  };


  const renderingHasData = investments.length > 0 || transactions.length > 0;

  return (
    <div className="dashboard-page">
      {loading && <div className="dashboard-loading">Loading dashboard...</div>}
      {error && <div className="dashboard-error">{error}</div>}

      {!loading && !error && (
        <>
          <section className="dashboard-summary">
            <div className="card">
              <div className="card-title">Total Investment</div>
              <div className="card-value">{formatCurrency(summary.totalInvestment)}</div>
            </div>
            <div className="card">
              <div className="card-title">Total Profit/Loss</div>
              <div className="card-value">{formatCurrency(summary.totalProfitLoss)}</div>
            </div>
            <div className="card">
              <div className="card-title">Active Assets</div>
              <div className="card-value">{summary.activeAssets}</div>
            </div>
            <div className="card">
              <div className="card-title">Upcoming Maturities</div>
              <div className="card-value">{summary.upcomingMaturities.length}</div>
            </div>
          </section>

          <section className="dashboard-charts">
            <div className="chart-card">
              <div className="chart-header">
                <h3>Asset Allocation</h3>
              </div>
              <div className="chart-content">
                {allocation.entries.length ? (
                  <div
                    className="pie-chart"
                    style={{
                      background: `conic-gradient(${allocation.entries
                        .map((entry, idx) => {
                          const start = allocation.entries
                            .slice(0, idx)
                            .reduce((sum, e) => sum + e.percent, 0);
                          const end = start + entry.percent;
                          return `${entry.color} ${start.toFixed(1)}% ${end.toFixed(1)}%`;
                        })
                        .join(', ')})`
                    }}
                  />
                ) : (
                  <div className="chart-placeholder">No allocation data</div>
                )}

                <div className="chart-legend">
                  {allocation.entries.map((entry) => (
                    <div key={entry.type} className="legend-item">
                      <span className="legend-color" style={{ background: entry.color }} />
                      <span className="legend-label">
                        {entry.type} ({entry.percent.toFixed(0)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="chart-card">
              <div className="chart-header">
                <h3>Investment Growth</h3>
              </div>
              <div className="chart-content">
                {chartData.length ? (
                  <svg className="line-chart" viewBox="0 0 260 140" preserveAspectRatio="none">
                    <path
                      d={linePath(chartData.map((m) => m.value))}
                      fill="none"
                      stroke="#4f46e5"
                      strokeWidth="2"
                    />
                    <path
                      d={linePath(chartData.map((m) => m.profit))}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                  </svg>
                ) : (
                  <div className="chart-placeholder">No growth data available</div>
                )}
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#4f46e5' }} />
                    <span className="legend-label">Investment</span>
                  </div>
                  <div className="legend-item">
                    <span className="legend-color" style={{ background: '#10b981' }} />
                    <span className="legend-label">Profit</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="dashboard-main-grid">
            {viewMode === 'consolidated' && (
              <div className="company-summary">
                <div className="section-header">
                  <h3>Company Totals</h3>
                </div>
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Total Investment</th>
                      <th>Total Profit/Loss</th>
                      <th>Active Assets</th>
                      <th>Upcoming Maturities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perCompanySummary.map((row) => (
                      <tr
                      key={row.company}
                      className="clickable-row"
                      onClick={() => onSelectCompany?.(row.company)}
                    >
                      <td>{row.company}</td>
                      <td>{formatCurrency(row.totalInvestment)}</td>
                      <td>{formatCurrency(row.totalProfitLoss)}</td>
                      <td>{row.activeAssets}</td>
                      <td>{row.upcomingMaturities}</td>
                    </tr>
                    ))}
                    {!perCompanySummary.length && (
                      <tr>
                        <td colSpan={5} className="empty-row">
                          No company records available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="recent-transactions">
              <div className="section-header">
                <h3>Recent Transactions</h3>
              </div>
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    {viewMode === 'consolidated' && <th>Company</th>}
                    <th>Type</th>
                    <th>Description</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.slice(0, 8).map((tx) => (
                    <tr key={tx._id || `${tx.date}-${tx.amount}`}> 
                      <td>{new Date(tx.date).toLocaleDateString()}</td>
                      {viewMode === 'consolidated' && <td>{tx.company}</td>}
                      <td>{tx.type}</td>
                      <td>{tx.description || '-'}</td>
                      <td>{formatCurrency(tx.amount || 0)}</td>
                    </tr>
                  ))}
                  {!transactions.length && (
                    <tr>
                      <td colSpan={viewMode === 'consolidated' ? 5 : 4} className="empty-row">
                        No transactions available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="notifications-panel">
              <div className="section-header">
                <h3>Notifications</h3>
              </div>
              {summary.upcomingMaturities.length ? (
                <ul className="notifications-list">
                  {summary.upcomingMaturities.slice(0, 6).map(({ inv, maturity }) => (
                    <li key={`${inv._id || inv.date}-${maturity.toISOString()}`}>
                      <div className="notification-title">{inv.assetType || 'Asset'} maturity</div>
                      <div className="notification-detail">
                        {formatCurrency(inv.amount || 0)} maturing in {getDaysUntil(maturity)} days
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="notification-empty">No upcoming maturities in the next 30 days.</div>
              )}
            </div>
          </section>

          <section className="recent-investments">
            <div className="section-header">
              <h3>Recent Investments</h3>
            </div>
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  {viewMode === 'consolidated' && <th>Company</th>}
                  <th>Asset</th>
                  <th>Amount</th>
                  <th>Rate</th>
                  <th>Duration</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {investments.slice(0, 8).map((inv) => (
                  <tr key={inv._id || `${inv.date}-${inv.amount}`}>
                    <td>{new Date(inv.date).toLocaleDateString()}</td>
                    {viewMode === 'consolidated' && <td>{inv.company}</td>}
                    <td>{inv.assetType || '-'}</td>
                    <td>{formatCurrency(inv.amount || 0)}</td>
                    <td>{inv.rate !== undefined ? `${inv.rate.toFixed(1)}%` : '-'}</td>
                    <td>{inv.durationMonths != null ? `${inv.durationMonths} mo` : '-'}</td>
                    <td>{inv.status || '-'}</td>
                  </tr>
                ))}
                {!investments.length && (
                  <tr>
                    <td colSpan={viewMode === 'consolidated' ? 7 : 6} className="empty-row">
                      No investments available.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          {!renderingHasData && (
            <div className="dashboard-empty">
              <p>No data found for this view. Try selecting a different company or add investments/transactions.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
