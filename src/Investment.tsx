import React, { useEffect, useState } from 'react';
import './InvestmentForm.css';

type Investment = {
  id: string;
  date: string;
  company: string;
  assetType: string;
  amount: number;
  rate: number;
  durationMonths: number;
  status: string;
  buyingPrice?: number;
  sellingPrice?: number;
  shares?: number;
  dividendRate?: number;
  calculatedInterest?: number;
  capitalGain?: number;
  dividendAmount?: number;
};

type Props = {
  currentCompany: string;
  user?: { fullName?: string; email?: string } | null;
};

function formatCurrency(n: number) {
  return `Br ${n.toLocaleString()}`;
}

const InvestmentPage: React.FC<Props> = ({ currentCompany, user }) => {
  const [showForm, setShowForm] = useState(false);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editing, setEditing] = useState<Investment | null>(null);

  useEffect(() => {
    // fetch investments for current company
    const load = async () => {
      try {
        const q = currentCompany ? `?company=${encodeURIComponent(currentCompany)}` : '';
        const res = await fetch(`/api/investments${q}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        // normalize documents returned from server
        const normalized: Investment[] = (data || []).map((d: any) => ({
          id: d.id || d._id || (d._id && d._id.toString()) || String(d._id),
          date: d.date,
          company: d.company,
          assetType: d.assetType,
          amount: Number(d.amount || 0),
          rate: Number(d.rate || 0),
          durationMonths: Number(d.durationMonths || 0),
          buyingPrice: d.buyingPrice ? Number(d.buyingPrice) : undefined,
          sellingPrice: d.sellingPrice ? Number(d.sellingPrice) : undefined,
          shares: d.shares ? Number(d.shares) : undefined,
          dividendRate: d.dividendRate ? Number(d.dividendRate) : undefined,
          calculatedInterest: d.calculatedInterest ? Number(d.calculatedInterest) : undefined,
          capitalGain: d.capitalGain ? Number(d.capitalGain) : undefined,
          dividendAmount: d.dividendAmount ? Number(d.dividendAmount) : undefined,
          status: d.status || 'Active'
        }));
        setInvestments(normalized);
      } catch (err) {
        console.warn('Could not load investments', err);
      }
    };
    load();
  }, [currentCompany]);

  // compute filtered list based on search (guard against undefined fields)
  const filteredList = investments.filter(inv => {
    const q = (searchTerm || '').trim().toLowerCase();
    if (!q) return true;
    const company = (inv.company ?? '').toLowerCase();
    const asset = (inv.assetType ?? '').toLowerCase();
    return company.includes(q) || asset.includes(q);
  });

  const calculateInterest = (amount: number, rate: number, months: number) => {
    const years = months / 12;
    return amount * (rate / 100) * years;
  };

  const calculateCapitalGain = (buyingPrice?: number, sellingPrice?: number) => {
    if (!buyingPrice && !sellingPrice) return 0;
    return (sellingPrice || 0) - (buyingPrice || 0);
  };

  const calculateDividend = (shares?: number, dividendRate?: number) => {
    if (!shares || !dividendRate) return 0;
    return shares * dividendRate;
  };

  const getCalculationDisplay = (inv: Investment) => {
    const interest = calculateInterest(inv.amount, inv.rate, inv.durationMonths);
    const capitalGain = calculateCapitalGain(inv.buyingPrice, inv.sellingPrice);
    const dividend = calculateDividend(inv.shares, inv.dividendRate);

    const items: React.ReactNode[] = [];
    if (interest) {
      items.push(
        <div key="interest">Interest: Br {Math.round(interest).toLocaleString()}</div>
      );
    }
    if (capitalGain) {
      items.push(
        <div key="capital">Capital Gain: Br {capitalGain.toLocaleString()}</div>
      );
    }
    if (dividend) {
      items.push(
        <div key="dividend">Dividend: Br {dividend.toLocaleString()}</div>
      );
    }

    if (items.length === 0) {
      return '—';
    }
    return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{items}</div>;
  };

  const handleAdd = async (data: Partial<Investment>) => {
    console.log('handleAdd called with', data);
    try {
      const body = {
        date: data.date || new Date().toISOString().slice(0, 10),
        company: data.company || currentCompany,
        assetType: data.assetType || 'Savings',
        amount: Number(data.amount || 0),
        rate: Number(data.rate || 0),
        durationMonths: Number(data.durationMonths || 12),
        status: 'Active',
        updatedBy: user?.fullName || user?.email || 'System'
      };
      console.log('sending to API', body);
      const res = await fetch('/api/investments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('API returned error status', res.status, txt);
        throw new Error('Failed to save');
      }
      const created = await res.json();
      console.log('API responded with', created);
      const inv: Investment = {
        id: created.id || (created._id && created._id.toString()) || Date.now().toString(36),
        date: created.date,
        company: created.company,
        assetType: created.assetType,
        amount: Number(created.amount || 0),
        rate: Number(created.rate || 0),
        durationMonths: Number(created.durationMonths || 12),
        status: created.status || 'Active'
      };
      setInvestments((s) => [inv, ...s]);
      setShowForm(false);
    } catch (err) {
      alert('Could not save investment');
      console.warn(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this investment?')) return;
    try {
      const res = await fetch(`/api/investments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      setInvestments((s) => s.filter(i => i.id !== id));
    } catch (err) {
      alert('Could not delete investment');
      console.warn(err);
    }
  };

  const handleUpdate = async (id: string, data: Partial<Investment>) => {
    try {
      const body = {
        ...data,
        updatedBy: user?.fullName || user?.email || 'System'
      };

      const res = await fetch(`/api/investments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('API returned error status', res.status, txt);
        throw new Error('Failed to update');
      }

      // update local list
      setInvestments((prev) => prev.map(inv => (inv.id === id ? { ...inv, ...data } : inv)));
      setShowForm(false);
      setEditing(null);
    } catch (err) {
      alert('Could not update investment');
      console.warn(err);
    }
  };

  return (
    <div className="investments-page">
      <div className="investments-header">
        <h2>Investments</h2>
        <div className="header-actions">
          <input
            type="text"
            placeholder="Search by company or asset"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <button onClick={() => { 
            setShowForm(true); 
            setEditing(null); 
          }} className="btn-primary">Add Investment</button>
        </div>
      </div>

      {showForm && (
        <div className="investment-form-overlay">
          <div className="investment-form-card">
            <h3>{editing ? 'Edit Investment' : 'Add Investment'}</h3>
            <InvestmentForm
              defaultCompany={currentCompany}
              initialValues={editing || undefined}
              onCancel={() => {
                setShowForm(false);
                setEditing(null);
              }}
              onSave={(d) => {
                if (editing) {
                  handleUpdate(editing.id, d);
                } else {
                  handleAdd(d);
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="investments-list">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Company</th>
              <th>Investment Type</th>
              <th>Principal</th>
              <th>Rate (%)</th>
              <th>Duration (mo)</th>
              <th>Calculated</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredList.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center' }}>No investments yet.</td></tr>
            ) : (
              filteredList.map(inv => (
                <tr key={inv.id}>
                  <td>{new Date(inv.date).toLocaleDateString()}</td>
                  <td>{inv.company}</td>
                  <td>{inv.assetType}</td>
                  <td>{formatCurrency(inv.amount)}</td>
                  <td>{inv.rate}</td>
                  <td>{inv.durationMonths}</td>
                  <td>{getCalculationDisplay(inv)}</td>
                  <td>{inv.status}</td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <button onClick={() => { 
                        setEditing(inv); 
                        setShowForm(true); 
                      }}>Edit</button>
                      <button onClick={() => handleDelete(inv.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvestmentPage;

// Small embedded form component
type FormProps = {
  defaultCompany: string;
  initialValues?: Partial<Investment>;
  onCancel: () => void;
  onSave: (data: Partial<Investment>) => void;
};

const InvestmentForm: React.FC<FormProps> = ({ defaultCompany, initialValues, onCancel, onSave }) => {
  const [date, setDate] = useState(initialValues?.date || new Date().toISOString().slice(0, 10));
  const [company, setCompany] = useState(initialValues?.company || defaultCompany || '');
  const [assetType, setAssetType] = useState(initialValues?.assetType || 'Savings');
  const [amount, setAmount] = useState<number | string>(initialValues?.amount ?? '');
  const [rate, setRate] = useState<number | string>(initialValues?.rate ?? '');
  const [durationMonths, setDurationMonths] = useState<number | string>(initialValues?.durationMonths ?? 12);
  const [buyingPrice, setBuyingPrice] = useState<number | string>(initialValues?.buyingPrice ?? '');
  const [sellingPrice, setSellingPrice] = useState<number | string>(initialValues?.sellingPrice ?? '');
  const [shares, setShares] = useState<number | string>(initialValues?.shares ?? '');
  const [dividendRate, setDividendRate] = useState<number | string>(initialValues?.dividendRate ?? '');

  const submit = () => {
    if (!amount || Number(amount) <= 0) { alert('Enter a valid amount'); return; }
    if (!rate || Number(rate) <= 0) { alert('Enter a valid rate'); return; }

    if (assetType === 'Capital Gain' || assetType === 'Shares') {
      if (!buyingPrice || !sellingPrice) {
        alert('Please provide both buying and selling price for capital gain');
        return;
      }
    }

    if (assetType === 'Dividend' || assetType === 'Shares') {
      if (!shares || !dividendRate) {
        alert('Please provide shares and dividend rate for dividend calculation');
        return;
      }
    }

    onSave({
      date,
      company,
      assetType,
      amount: Number(amount),
      rate: Number(rate),
      durationMonths: Number(durationMonths),
      buyingPrice: buyingPrice === '' ? undefined : Number(buyingPrice),
      sellingPrice: sellingPrice === '' ? undefined : Number(sellingPrice),
      shares: shares === '' ? undefined : Number(shares),
      dividendRate: dividendRate === '' ? undefined : Number(dividendRate)
    });
  };

  // Helper functions for calculations
  const calculateInterest = (amount: number, rate: number, months: number) => {
    const years = months / 12;
    return amount * (rate / 100) * years;
  };

  const calculateCapitalGain = (buyingPrice?: number, sellingPrice?: number) => {
    if (!buyingPrice && !sellingPrice) return 0;
    return (sellingPrice || 0) - (buyingPrice || 0);
  };

  const calculateDividend = (shares?: number, dividendRate?: number) => {
    if (!shares || !dividendRate) return 0;
    return shares * dividendRate;
  };

  const interestValue = calculateInterest(Number(amount), Number(rate), Number(durationMonths));
  const capitalGainValue = calculateCapitalGain(Number(buyingPrice), Number(sellingPrice));
  const dividendValue = calculateDividend(Number(shares), Number(dividendRate));

  const getPreviewText = () => {
    if (capitalGainValue) return `Capital gain: Br ${capitalGainValue.toLocaleString()}`;
    if (dividendValue) return `Dividend: Br ${dividendValue.toLocaleString()}`;
    return `Interest: Br ${Math.round(interestValue).toLocaleString()}`;
  };

  return (
    <div className="form-grid">
      <label>
        Date
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label>
        Company
        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} />
      </label>
      <label>
        Investment Type
        <select value={assetType} onChange={(e) => setAssetType(e.target.value)}>
          <option> Savings </option>
          <option> Bonds </option>
          <option> T-Bills </option>
          <option> Shares </option>
          <option> Capital Gain </option>
          <option> Dividend </option>
          <option> Other </option>
        </select>
      </label>
      <label>
        Principal (ETB)
        <input type="number" value={amount as any} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label>
        Rate (%)
        <input type="number" step="0.01" value={rate as any} onChange={(e) => setRate(e.target.value)} />
      </label>

      {(assetType === 'Savings' || assetType === 'Bonds' || assetType === 'T-Bills' || assetType === 'Other') && (
        <label>
          Duration (months)
          <input type="number" value={durationMonths as any} onChange={(e) => setDurationMonths(e.target.value)} />
        </label>
      )}

      {(assetType === 'Shares' || assetType === 'Capital Gain') && (
        <>
          <label>
            Buying Price (ETB)
            <input type="number" value={buyingPrice as any} onChange={(e) => setBuyingPrice(e.target.value)} />
          </label>
          <label>
            Selling Price (ETB)
            <input type="number" value={sellingPrice as any} onChange={(e) => setSellingPrice(e.target.value)} />
          </label>
        </>
      )}

      {(assetType === 'Shares' || assetType === 'Dividend') && (
        <>
          <label>
            Shares
            <input type="number" value={shares as any} onChange={(e) => setShares(e.target.value)} />
          </label>
          <label>
            Dividend Rate (per share)
            <input type="number" step="0.01" value={dividendRate as any} onChange={(e) => setDividendRate(e.target.value)} />
          </label>
        </>
      )}

      <div style={{ gridColumn: '1 / -1', padding: '0.5rem', border: '1px solid #e2e8f0', borderRadius: 4, background: '#f8fafc' }}>
        <strong>Calculation Preview:</strong> {getPreviewText()}
      </div>

      <div className="form-actions">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={submit} className="btn-primary">Save</button>
      </div>
    </div>
  );
};
