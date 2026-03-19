import React from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import './Reports.css';

type Transaction = {
  _id?: string;
  id?: string | number;
  company?: string;
  date: string;
  type: string;
  description: string;
  amount: string;
  status: string;
};

type PnlRow = {
  key: string;
  label: string;
  total: number;
  details: Transaction[];
};

const formatCurrency = (value: number) => {
  return value.toLocaleString('en-ET', { style: 'currency', currency: 'ETB' });
};

const normalizeCompany = (company?: any) => {
  const raw = (company || '').toString();
  const trimmed = raw.trim();
  // remove stray quotes in stored company names like "" or "Name"
  return trimmed.replace(/^"+|"+$/g, '').trim();
};

const parseAmount = (value: any) => {
  if (value == null) return 0;
  const raw = String(value).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};

const isApproved = (t: Transaction) => {
  const s = (t.status || '').toString().toLowerCase();
  return s === 'approved' || s === 'completed' || s === 'paid';
};

const groupByCompany = (transactions: Transaction[]) => {
  const map: Record<string, Transaction[]> = {};
  transactions.forEach((t) => {
    const company = t.company || 'Unknown';
    if (!map[company]) map[company] = [];
    map[company].push(t);
  });
  return map;
};

const computePnl = (transactions: Transaction[]) => {
  const rows: PnlRow[] = [];

  // We'll treat "Sell" as revenue and "Buy"/"Transfer" as cost.
  const revenue = transactions
    .filter((t) => t.type.toLowerCase() === 'sell')
    .reduce((acc, t) => acc + parseAmount(t.amount), 0);
  const cost = transactions
    .filter((t) => t.type.toLowerCase() !== 'sell')
    .reduce((acc, t) => acc + parseAmount(t.amount), 0);

  const net = revenue - cost;

  rows.push({
    key: 'revenue',
    label: 'Revenue (Sell)',
    total: revenue,
    details: transactions.filter((t) => t.type.toLowerCase() === 'sell'),
  });
  rows.push({
    key: 'cost',
    label: 'Cost (Buy/Transfer)',
    total: cost,
    details: transactions.filter((t) => t.type.toLowerCase() !== 'sell'),
  });
  rows.push({
    key: 'net',
    label: 'Net P&L',
    total: net,
    details: transactions,
  });

  return rows;
};

const filterByDate = (transactions: Transaction[], start?: string, end?: string) => {
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate && !endDate) return transactions;

  return transactions.filter((t) => {
    const d = new Date(t.date);
    if (startDate && d < startDate) return false;
    if (endDate) {
      // include end date full day
      const endDay = new Date(endDate);
      endDay.setHours(23, 59, 59, 999);
      if (d > endDay) return false;
    }
    return true;
  });
};

function Reports() {
  const [transactions, setTransactions] = React.useState<Transaction[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [companyFilter, setCompanyFilter] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const loadTransactions = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/transactions');
      if (!res.ok) throw new Error('Failed to load transactions');
      const data = await res.json();
      if (Array.isArray(data)) {
        const normalized = data.map((t: any) => ({
          ...t,
          company: normalizeCompany(t.company),
        }));
        setTransactions(normalized);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Error loading transactions', err);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const companies = React.useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const c = normalizeCompany(t.company);
      if (c) set.add(c);
    });
    const list = Array.from(set).sort();
    const hasUnknown = transactions.some((t) => !normalizeCompany(t.company));
    if (hasUnknown && !list.includes('Unknown')) {
      list.unshift('Unknown');
    }
    return list;
  }, [transactions]);

  const filtered = React.useMemo(() => {
    let list = transactions;
    if (companyFilter) {
      list = list.filter((t) => {
        if (companyFilter === 'Unknown') {
          return !t.company || t.company.toString().trim() === '';
        }
        return (t.company || '').toLowerCase() === companyFilter.toLowerCase();
      });
    }
    list = filterByDate(list, startDate, endDate);
    // only approved/paid by default for reports
    list = list.filter(isApproved);
    return list;
  }, [transactions, companyFilter, startDate, endDate]);

  const grouped = React.useMemo(() => {
    if (!companyFilter) {
      const byCompany = groupByCompany(filtered);
      return Object.entries(byCompany).map(([company, txs]) => ({
        company,
        pnl: computePnl(txs),
      }));
    }
    return [
      {
        company: companyFilter || 'All Companies',
        pnl: computePnl(filtered),
      },
    ];
  }, [filtered, companyFilter]);

  const exportExcel = () => {
    const wb = utils.book_new();
    grouped.forEach((group) => {
      const wsData = [] as any[];
      wsData.push(['Company', group.company]);
      wsData.push([]);
      wsData.push(['Section', 'Total']);
      group.pnl.forEach((row) => {
        wsData.push([row.label, row.total]);
      });
      const ws = utils.aoa_to_sheet(wsData);
      utils.book_append_sheet(wb, ws, group.company.slice(0, 30) || 'Report');
    });
    writeFile(wb, 'pnl-report.xlsx');
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16);
    doc.text('P&L Report', 14, 16);
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 24);

    let y = 30;
    grouped.forEach((group, idx) => {
      doc.setFontSize(12);
      doc.text(`Company: ${group.company}`, 14, y);
      y += 6;
      const tableData = group.pnl.map((r) => [r.label, formatCurrency(r.total)]);
      // @ts-ignore
      (doc as any).autoTable({
        startY: y,
        head: [['Section', 'Total']],
        body: tableData,
        theme: 'grid',
      });
      y = (doc as any).lastAutoTable.finalY + 10;
      if (idx < grouped.length - 1 && y > 150) {
        doc.addPage();
        y = 20;
      }
    });

    doc.save('pnl-report.pdf');
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => (prev === key ? null : key));
  };

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h2>Reports</h2>
        <div className="reports-actions">
          <button className="action-btn export-pdf" onClick={exportPdf}>Export PDF</button>
          <button className="action-btn export-excel" onClick={exportExcel}>Export Excel</button>
        </div>
      </div>

      <div className="reports-filters">
        <div className="filter-item">
          <label>Company</label>
          <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}>
            <option value="">All Companies</option>
            {companies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="filter-item">
          <label>From</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="filter-item">
          <label>To</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="filter-item">
          <button className="action-btn" onClick={() => loadTransactions()}>Reload</button>
        </div>
      </div>

      {loading ? (
        <div className="reports-loading">Loading transactions...</div>
      ) : (
        <div className="reports-grid">
          {grouped.length === 0 && (
            <div className="reports-empty">No data available for selected filters.</div>
          )}

          {grouped.map((group) => (
            <div key={group.company} className="report-card">
              <div className="report-card-header">
                <div className="report-company">{group.company}</div>
                <button className="action-btn small" onClick={() => toggleExpand(group.company)}>
                  {expanded === group.company ? 'Hide details' : 'Drill down'}
                </button>
              </div>

              <table className="report-table">
                <thead>
                  <tr>
                    <th>Section</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {group.pnl.map((row) => (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{formatCurrency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {expanded === group.company && (
                <div className="report-drilldown">
                  <h4>Transactions</h4>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Description</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.pnl
                        .flatMap((r) => r.details)
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((tx) => (
                          <tr key={tx._id || tx.id || `${tx.date}-${tx.amount}`}>
                            <td>{tx.date}</td>
                            <td>{tx.type}</td>
                            <td>{tx.description}</td>
                            <td>{formatCurrency(parseAmount(tx.amount))}</td>
                            <td>{tx.status}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Reports;
