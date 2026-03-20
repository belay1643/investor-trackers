import React from 'react';
import './AuditLogs.css';

interface AuditLog {
    id: string;
    timestamp: string;
    user: string;
    action: string;
    actionType: 'UPDATE' | 'CREATE' | 'APPROVE' | 'LOGIN' | 'EXPORT' | 'DELETE';
    details: string;
    ip?: string;
    oldValue?: string;
    newValue?: string;
    company: string;
}

type Company = { _id?: string; id?: string; name: string };

type Props = {
    currentCompany: string;
    companies: Company[];
};

function AuditLogs({ currentCompany, companies }: Props) {
    const [selectedCompany, setSelectedCompany] = React.useState('');
    const [filterCategory, setFilterCategory] = React.useState('7days');
    const [currentPage, setCurrentPage] = React.useState(1);
    const itemsPerPage = 20;

    const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const loadAuditLogs = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            if (selectedCompany) params.set('company', selectedCompany);
            params.set('limit', '200');
            const res = await fetch(`/api/audit-logs?${params.toString()}`);
            if (!res.ok) throw new Error(`Failed to fetch audit logs (${res.status})`);
            const data = await res.json();
            if (!Array.isArray(data)) throw new Error('Unexpected audit log payload');
            setAuditLogs(data);
        } catch (err: any) {
            console.error('Error loading audit logs:', err);
            setError(err?.message || 'Failed to load audit logs');
            setAuditLogs([]);
        } finally {
            setLoading(false);
        }
    }, [selectedCompany]);

    React.useEffect(() => {
        loadAuditLogs();
    }, [loadAuditLogs]);

    React.useEffect(() => {
        // Initialize filter to current company if not set yet
        if (!selectedCompany && currentCompany) {
            setSelectedCompany(currentCompany);
        }
    }, [currentCompany, selectedCompany]);

    // Filter logs based on company and time range
    const parseTimestampToDate = (timestamp: string | number | Date) => {
        if (!timestamp) return new Date();
        const d = new Date(timestamp as any);
        if (Number.isNaN(d.getTime())) {
            // fallback for old sample format: MM-DD HH:mm
            const parts = String(timestamp).split(' ');
            if (parts.length === 2) {
                const [monthDay, time] = parts;
                const [month, day] = monthDay.split('-').map(Number);
                const [hour, minute] = time.split(':').map(Number);
                const now = new Date();
                return new Date(now.getFullYear(), month - 1, day, hour, minute);
            }
            return new Date();
        }
        return d;
    };

    const formatDateTime = (value: string | number | Date) => {
        const d = parseTimestampToDate(value);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mi = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
    };

    const renderValueLines = (value: string) => {
        if (!value) return '-';
        try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
                return Object.entries(parsed)
                    .filter(([k]) => !['_id', 'updatedAt', 'createdAt', 'date', 'company', 'rate', 'durationMonths', 'status'].includes(k))
                    .map(([k, v]) => (
                        <div key={k} className="audit-json-line">
                            <span className="audit-json-key">{k}:</span> <span className="audit-json-val">{String(v)}</span>
                        </div>
                    ));
            }
        } catch {
            // not JSON
        }
        return <div>{value}</div>;
    };


    const filteredLogs = auditLogs.filter((log) => {
        const matchesCompany = !selectedCompany || selectedCompany === '' || log.company === selectedCompany;

        if (!matchesCompany) return false;

        if (filterCategory === 'All') return true;

        const logDate = parseTimestampToDate(log.timestamp);
        const now = new Date();
        const diffDays = (now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24);

        switch (filterCategory) {
            case '7days':
                return diffDays <= 7;
            case '30days':
                return diffDays <= 30;
            case '90days':
                return diffDays <= 90;
            case 'alltime':
                return true;
            default:
                return true;
        }
    });

    // Pagination
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentLogs = filteredLogs.slice(startIndex, endIndex);

    const handlePrevPage = () => {
        if (currentPage > 1) {
            setCurrentPage(currentPage - 1);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            setCurrentPage(currentPage + 1);
        }
    };

    const handleApplyFilters = () => {
        setCurrentPage(1);
        loadAuditLogs();
    };

    const getActionColor = (actionType: string) => {
        switch (actionType) {
            case 'UPDATE': return 'action-update';
            case 'CREATE': return 'action-create';
            case 'APPROVE': return 'action-approve';
            case 'LOGIN': return 'action-login';
            case 'EXPORT': return 'action-export';
            case 'DELETE': return 'action-delete';
            default: return '';
        }
    };

    return (
        <div className="audit-logs-container">
            <div className="audit-content-wrapper">
                        <div className="audit-filters">
                    <span className="filter-icon">🔍</span>
                    <span className="filter-label">Filter:</span>
                    <select
                        value={selectedCompany}
                        onChange={(e) => setSelectedCompany(e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Companies</option>
                        {companies.map((company) => (
                            <option key={company._id || company.id || company.name} value={company.name}>
                                {company.name}
                            </option>
                        ))}
                    </select>
                    <select
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="filter-select"
                    >
                        <option value="7days">Last 7 days</option>
                        <option value="30days">Last 30 days</option>
                        <option value="90days">Last 90 days</option>
                        <option value="alltime">All time</option>
                    </select>
                    <button className="apply-btn" onClick={handleApplyFilters}>
                        Apply
                    </button>
                </div>

                <div className="audit-header">
                    <h2><span className="breadcrumb">› System Activity</span></h2>
                </div>

                <div className="audit-table-wrapper">
                    <table className="audit-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Company</th>
                                <th>INV Type</th>
                                <th>IP</th>
                                <th>Date</th>
                                <th>New Value</th>
                                <th>Old Value</th>
                            </tr>
                        </thead>
                        <tbody>
                            {currentLogs.length > 0 ? (
                                currentLogs.map(log => (
                                    <tr key={log.id}>
                                        <td className="user-cell">{log.user}</td>
                                        <td className="company-cell">{log.company}</td>
                                        <td>
                                            <span className={`action-badge ${getActionColor(log.actionType)}`}>
                                                {log.actionType}
                                            </span>
                                            <div className="details-main">{log.action}</div>
                                        </td>
                                        <td className="ip-cell">{log.ip || '-'}</td>
                                        <td className="timestamp-cell">{formatDateTime(log.timestamp)}</td>
                                        <td className="details-sub">
                                            <div className="audit-json">{renderValueLines(log.newValue || '')}</div>
                                        </td>
                                        <td className="details-sub">
                                            <div className="audit-json">{renderValueLines(log.oldValue || '')}</div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="no-data">
                                        No audit logs found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="audit-pagination">
                    <button
                        className="pagination-btn"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                    >
                        ‹ Prev
                    </button>
                    <button
                        className="pagination-nav"
                        onClick={handlePrevPage}
                        disabled={currentPage === 1}
                    >
                        ‹
                    </button>
                    <span className="pagination-info">
                        Page {currentPage} of {totalPages || 1}
                    </span>
                    <button
                        className="pagination-nav"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        ›
                    </button>
                    <button
                        className="pagination-btn"
                        onClick={handleNextPage}
                        disabled={currentPage === totalPages || totalPages === 0}
                    >
                        Next ›
                    </button>
                </div>
            </div>
        </div>
    );
}

export default AuditLogs;
