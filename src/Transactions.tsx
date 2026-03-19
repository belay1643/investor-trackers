import React from 'react';
import './Transactions.css';

interface Transaction {
    id?: number | string;
    _id?: string;
    company?: string;
    date: string;
    type: string;
    description: string;
    amount: string;
    status: string;
}

type Props = {
    currentCompany: string;
};

function Transactions({ currentCompany }: Props) {
    const [transactions, setTransactions] = React.useState<Transaction[]>([]);
    const [companies, setCompanies] = React.useState<string[]>([]);
    const [filterType, setFilterType] = React.useState('All Types');
    const [filterPeriod, setFilterPeriod] = React.useState('Last 30 days');
    const [showForm, setShowForm] = React.useState(false);
    const [filteredTransactions, setFilteredTransactions] = React.useState<Transaction[]>([]);
    const [showBulkModal, setShowBulkModal] = React.useState(false);

    React.useEffect(() => {
        const load = async () => {
            try {
                const q = currentCompany ? `?company=${encodeURIComponent(currentCompany)}` : '';
                const res = await fetch(`/api/transactions${q}`);
                if (!res.ok) throw new Error('failed');
                const data = await res.json();
                setTransactions(data);
                setFilteredTransactions(data);
            } catch (err) {
                console.error('could not fetch transactions', err);
            }
        };
        load();
    }, [currentCompany]);

    React.useEffect(() => {
        const loadCompanies = async () => {
            try {
                const res = await fetch('/api/companies');
                if (!res.ok) throw new Error('Failed to load companies');
                const data = await res.json();
                if (Array.isArray(data)) {
                    const companyNames = Array.from(
                        new Set(
                            data
                                .map((c: any) => (c?.name || '').toString().trim())
                                .filter((name: string) => !!name)
                        )
                    ).sort();
                    setCompanies(companyNames);
                }
            } catch (err) {
                console.error('Error loading companies', err);
                setCompanies([]);
            }
        };
        loadCompanies();
    }, []);

    const handleAdd = async (tx: Partial<Transaction>) => {
        try {
            const body = {
                date: tx.date || new Date().toISOString().slice(0,10),
                type: tx.type || 'Buy',
                description: tx.description || '',
                amount: tx.amount || '0',
                status: (tx.status || 'pending').toString().toLowerCase(), // Always start as pending for approval
                company: tx.company || currentCompany,
                requestedBy: 'Current User', // TODO: replace with actual logged-in user
            } as any; // cast to allow company
            const res = await fetch('/api/transactions', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
            if (!res.ok) throw new Error('add failed');
            const created = await res.json();
            setTransactions(s => [created, ...s]);
            setShowForm(false);
            alert('Transaction submitted for approval!');
        } catch (err) {
            alert('Could not save transaction');
            console.error(err);
        }
    };

    const handleDelete = async (id: number | string) => {
        if (!confirm('Delete this transaction?')) return;
        try {
            const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('delete failed');
            setTransactions(s => s.filter(t => t.id !== id && t._id !== id));
            setFilteredTransactions(s => s.filter(t => t.id !== id && t._id !== id));
        } catch (err) {
            alert('Could not delete transaction');
            console.error(err);
        }
    };

    // helper functions inside component
    const applyFilterList = (list: Transaction[], type: string, period: string) => {
        let result = list;
        if (type && type !== 'All Types') {
            result = result.filter(t => t.type && t.type.toLowerCase() === type.toLowerCase());
        }
        if (period && period !== 'All Types') {
            const now = new Date();
            let days = 0;
            if (period === 'Last 30 days') days = 30;
            if (period === 'Last 90 days') days = 90;
            if (period === 'Last year') days = 365;
            if (days) {
                result = result.filter(t => {
                    const d = new Date(t.date);
                    return now.getTime() - d.getTime() <= days * 24 * 60 * 60 * 1000;
                });
            }
        }
        return result;
    };

    const formatAsCSV = (rows: any[]) => {
        if (!rows || rows.length === 0) return '';
        const keys = Object.keys(rows[0]);
        const lines = [keys.join(',')];
        rows.forEach(r => {
            const vals = keys.map(k => {
                let v = r[k];
                if (v == null) v = '';
                return `"${String(v).replace(/"/g,'""')}"`;
            });
            lines.push(vals.join(','));
        });
        return lines.join('\n');
    };

    const exportCsv = () => {
        const csv = formatAsCSV(filteredTransactions.length ? filteredTransactions : transactions);
        if (!csv) return;
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'transactions.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const applyFilters = () => {
        setFilteredTransactions(applyFilterList(transactions, filterType, filterPeriod));
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const text = ev.target?.result as string;
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            const headers = lines[0].split(',').map(h => h.trim());
            const docs = lines.slice(1).map(l => {
                const vals = l.split(',');
                const obj: any = {};
                headers.forEach((h,i) => { obj[h] = vals[i]; });
                return obj;
            });
            try {
                const res = await fetch('/api/transactions/bulk', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(docs) });
                const data = await res.json();
                alert(`Inserted ${data.insertedCount || 0} records`);
                // reload list
                const q = currentCompany ? `?company=${encodeURIComponent(currentCompany)}` : '';
                const r2 = await fetch(`/api/transactions${q}`);
                const newList = await r2.json();
                setTransactions(newList);
                setFilteredTransactions(applyFilterList(newList, filterType, filterPeriod));
            } catch (err) {
                console.error('bulk upload failed', err);
                alert('Bulk upload failed');
            }
            setShowBulkModal(false);
        };
        reader.readAsText(file);
    };

    return (
        <div className="transactions-container">
            <div className="transactions-header">
                <h2>Transactions{currentCompany ? ` – ${currentCompany}` : ''}</h2>
                <div className="actions">
                    <button onClick={() => setShowForm(true)} className="action-btn new">+ New Transaction</button>
                    <button onClick={() => setShowBulkModal(true)} className="action-btn">Bulk Upload</button>
                    <button onClick={exportCsv} className="action-btn">Export</button>
                </div>
            </div>
            {showForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Add Transaction</h3>
                        <TransactionForm
                            defaultCompany={currentCompany}
                            companies={companies}
                            onCancel={() => setShowForm(false)}
                            onSave={handleAdd}
                        />
                    </div>
                </div>
            )}
            {showBulkModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3>Bulk Upload</h3>
                        <input type="file" accept=".csv" onChange={handleFileSelect} />
                        <div className="form-actions">
                            <button type="button" onClick={() => setShowBulkModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="transactions-filters">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                    <option>All Types</option>
                    <option>Buy</option>
                    <option>Sell</option>
                    <option>Transfer</option>
                </select>
                <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)}>
                    <option>Last 30 days</option>
                    <option>Last 90 days</option>
                    <option>Last year</option>
                </select>
                <button className="apply-btn" onClick={applyFilters}>Apply</button>
            </div>

            <div className="transactions-table-container">
                <table className="transactions-table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Description</th>
                            <th>Company</th>
                            <th>Amount</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransactions.length === 0 ? (
                            <tr>
                                <td colSpan={7} style={{ textAlign: 'center' }}>
                                    No transactions to display
                                </td>
                            </tr>
                        ) : (
                            filteredTransactions.map((tx) => (
                                <tr key={tx.id || tx._id}>
                                    <td>{tx.date}</td>
                                    <td onClick={() => { setFilterType(tx.type); applyFilters(); }} style={{cursor:'pointer', textDecoration:'underline'}}>{tx.type}</td>
                                    <td>{tx.description}</td>
                                    <td>{tx.company || 'Unknown'}</td>
                                    <td>{tx.amount}</td>
                                    <td>{tx.status}</td>
                                    <td>
                                        {(tx.id || tx._id) && (
                                          <button onClick={() => handleDelete(tx.id || tx._id)}>Delete</button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

        </div>
    );
}


export default Transactions;

// simple form component

type TransactionFormProps = {
    defaultCompany: string;
    companies: string[];
    onCancel: () => void;
    onSave: (tx: Partial<Transaction>) => void;
};

const TransactionForm: React.FC<TransactionFormProps> = ({ defaultCompany, companies, onCancel, onSave }) => {
    const [date, setDate] = React.useState(new Date().toISOString().slice(0,10));
    const [type, setType] = React.useState('Buy');
    const [description, setDescription] = React.useState('');
    const [amount, setAmount] = React.useState('');
    const [status, setStatus] = React.useState('Pending');
    const [company, setCompany] = React.useState(defaultCompany);

    const submit = () => {
        if (!amount) { alert('Amount required'); return; }
        onSave({ date, type, description, amount, status, company } as any);
    };

    return (
        <div className="form-grid">
            <label>Date<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
            <label>Type
                <select value={type} onChange={e => setType(e.target.value)}>
                    <option>Buy</option>
                    <option>Sell</option>
                    <option>Transfer</option>
                </select>
            </label>
            <label>Description<input type="text" value={description} onChange={e => setDescription(e.target.value)} /></label>
            <label>Amount<input type="text" value={amount} onChange={e => setAmount(e.target.value)} /></label>
            <label>Company
                <select value={company} onChange={e => setCompany(e.target.value)}>
                    <option value="">Select Company</option>
                    {companies.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </label>
            <label>Status
                <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option>Pending</option>
                    <option>Completed</option>
                    <option>Declined</option>
                </select>
            </label>
            <div className="form-actions">
                <button type="button" onClick={onCancel}>Cancel</button>
                <button type="button" onClick={submit}>Save</button>
            </div>
        </div>
    );
};