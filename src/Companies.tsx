import React, { useState, useEffect } from 'react';
import './Companies.css';

interface Company {
    id: string | number;
    name: string;
    description: string;
    status: 'Active' | 'Archived' | 'Pending';
    role: 'Admin' | 'Manager' | 'Viewer';
}

interface CompaniesProps {
    user: any;
    currentCompany: string;
    onCompanySwitch: (companyName: string) => void;
    // invoked when the component wants to switch to a specific section (e.g. 'transactions')
    onNavigate?: (section: string) => void;
}

function Companies({ user, currentCompany, onCompanySwitch, onNavigate }: CompaniesProps) {
    console.log('Companies component rendered!', { user, currentCompany }); // Debug log

    const [showCreateForm, setShowCreateForm] = useState(false);
    const [editingCompany, setEditingCompany] = useState<string | number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    // start with no companies; user will add their own
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5; // Show 5 companies per page

    // load companies from server when component mounts
    useEffect(() => {
        loadCompanies();
    }, []);

    const loadCompanies = async () => {
        setLoadingCompanies(true);
        try {
            const response = await fetch('/api/companies');
            if (response.ok) {
                const data = await response.json();
                const formattedCompanies = data.map((company: any) => ({
                    id: company._id,
                    name: company.name,
                    description: company.description,
                    status: company.status || 'Active',
                    role: company.role || 'Admin'
                }));
                setCompanies(formattedCompanies);
            }
        } catch (error) {
            console.error('Error loading companies:', error);
        } finally {
            setLoadingCompanies(false);
        }
    };
    // use a more precise type so status/role unions are respected
    type NewCompany = {
        name: string;
        description: string;
        status: '' | 'Active' | 'Archived' | 'Pending';
        role: '' | 'Admin' | 'Manager' | 'Viewer';
    };

    const [newCompany, setNewCompany] = useState<NewCompany>({
        name: '',
        description: '',
        status: '',           // optional, default applied on save
        role: ''              // optional, default applied on save
    });


    const filteredCompanies = companies.filter(company => {
        const q = (searchTerm || '').trim().toLowerCase();
        if (!q) return true;
        const name = (company.name ?? '').toLowerCase();
        const desc = (company.description ?? '').toLowerCase();
        return name.includes(q) || desc.includes(q);
    });

    // Calculate pagination
    const totalPages = Math.ceil(filteredCompanies.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentCompanies = filteredCompanies.slice(startIndex, endIndex);

    // Pagination handlers
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

    // Reset to page 1 when search term changes
    React.useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    // if loading show placeholder or spinner
    if (loadingCompanies) {
        return <div>Loading companies...</div>;
    }


    const isLikelyObjectId = (id: any) => {
        return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
    };

    const handleCreateCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newCompany.name && newCompany.description) {
            try {
                if (editingCompany) {
                    // Update existing company
                    // If editing a server-backed company (ObjectId), call API
                    if (isLikelyObjectId(editingCompany)) {
                        const response = await fetch(`/api/companies/${editingCompany}`, {
                            method: 'PUT',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                name: newCompany.name,
                                description: newCompany.description,
                                status: newCompany.status || 'Active',
                                role: newCompany.role || 'Admin'
                            }),
                        });

                        if (response.ok) {
                            setCompanies(companies.map(c =>
                                c.id === editingCompany
                                    ? {
                                        ...c,
                                        name: newCompany.name,
                                        description: newCompany.description,
                                        status: newCompany.status || c.status,
                                        role: newCompany.role || c.role
                                    }
                                    : c
                            ));
                            alert('Company updated successfully!');
                        } else {
                            const txt = await response.text().catch(() => '');
                            console.error('update failed', response.status, txt);
                            throw new Error('Failed to update company');
                        }
                    } else {
                        // Local-only company: update state without server call
                        setCompanies(companies.map(c =>
                            c.id === editingCompany
                                ? {
                                    ...c,
                                    name: newCompany.name,
                                    description: newCompany.description,
                                    status: newCompany.status || c.status,
                                    role: newCompany.role || c.role
                                }
                                : c
                        ));
                        alert('Company updated locally');
                    }
                } else {
                    // Create new company
                    const response = await fetch('/api/companies', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(newCompany),
                    });

                    const text = await response.text();
                    let createdCompany: any = null;
                    try {
                        createdCompany = text ? JSON.parse(text) : null;
                    } catch (err) {
                        console.warn('Could not parse create company response as JSON', err, text);
                    }

                    if (response.ok) {
                        const returnedId = createdCompany?.id || createdCompany?._id || createdCompany?.insertedId;
                        const company: Company = {
                            id: returnedId || companies.length + 1,
                            name: newCompany.name,
                            description: newCompany.description,
                            status: (newCompany.status as 'Active' | 'Archived' | 'Pending') || 'Active',
                            role: (newCompany.role as 'Admin' | 'Manager' | 'Viewer') || 'Viewer'
                        };
                        setCompanies([...companies, company]);
                        alert('Company created successfully!');
                    } else {
                        // try to show server-provided message
                        let serverMsg = text;
                        try {
                            const parsed = text ? JSON.parse(text) : null;
                            serverMsg = parsed?.message || parsed?.error || JSON.stringify(parsed) || text;
                        } catch { }
                        console.error('Create company failed:', response.status, serverMsg);
                        alert('Error saving company. ' + (serverMsg ? serverMsg : 'Please try again.'));
                        throw new Error('Failed to create company: ' + serverMsg);
                    }
                }

                setNewCompany({
                    name: '',
                    description: '',
                    status: '',
                    role: ''
                });
                setShowCreateForm(false);
                setEditingCompany(null);
            } catch (error) {
                console.error('Error saving company:', error);
                alert('Error saving company. Please try again.');
            }
        }
    };

    const handleEdit = (companyId: string | number) => {
        const company = companies.find(c => c.id === companyId);
        if (company) {
            // Pre-fill the form with existing company data
            setNewCompany({
                name: company.name,
                description: company.description,
                status: company.status || '',
                role: company.role || ''
            });
            setEditingCompany(companyId);
            setShowCreateForm(true);
        }
    };

    const handleManage = (companyId: string | number) => {
        const company = companies.find(c => c.id === companyId);
        if (company) {
            onCompanySwitch(company.name);
            // if parent provided navigation callback, go to transactions
            if (onNavigate) {
                onNavigate('transactions');
            } else {
                alert(`Now managing ${company.name}. You can view investments, transactions, and team members for this company.`);
            }
        }
    };

    const handleDelete = async (companyId: string | number) => {
        const company = companies.find(c => c.id === companyId);
        if (company && confirm(`Are you sure you want to delete "${company.name}"? This action cannot be undone.`)) {
            try {
                // If companyId looks like a Mongo ObjectId, call server; otherwise remove locally
                if (isLikelyObjectId(companyId)) {
                    const response = await fetch(`/api/companies/${companyId}`, {
                        method: 'DELETE',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });

                    if (response.ok) {
                        setCompanies(companies.filter(c => c.id !== companyId));
                        alert('Company deleted successfully!');
                    } else {
                        // try to read server error message
                        const txt = await response.text().catch(() => '');
                        let parsed = null;
                        try { parsed = txt ? JSON.parse(txt) : null; } catch (e) { parsed = null; }
                        const msg = (parsed && parsed.message) ? parsed.message : (txt || 'Failed to delete company');
                        console.error('delete failed', response.status, msg);
                        alert(msg);
                    }
                } else {
                    // local-only company - remove from state without server call
                    setCompanies(companies.filter(c => c.id !== companyId));
                    alert('Company removed locally');
                }
            } catch (error) {
                console.error('Error deleting company:', error);
                alert('Error deleting company. Please try again.');
            }
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'status-active';
            case 'Archived': return 'status-archived';
            case 'Pending': return 'status-pending';
            default: return '';
        }
    };

    const canCreateCompany = true; // Always show for demo purposes
    // const canCreateCompany = user?.role === 'Admin' || user?.permissions?.includes('create_company');


    return (
        <div className="companies-container">
            <div className="companies-card">
                {/* Page Header with Title */}
                <div className="page-header">
                    <div className="page-title">
                        <h1>Companies</h1>
                    </div>
                    <div className="page-actions">
                        {canCreateCompany && (
                            <>
                                <button
                                    className="add-company-btn"
                                    onClick={() => setShowCreateForm(true)}
                                >
                                    + Add New Company
                                </button>
                            </>
                        )}
                        <div className="search-container">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                </div>

                {/* Create Company Form Modal */}
            {showCreateForm && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>{editingCompany ? 'Edit Company' : 'Create New Company'}</h2>
                            <button
                                className="close-btn"
                                onClick={() => setShowCreateForm(false)}
                            >
                                ×
                            </button>
                        </div>
                        <form onSubmit={handleCreateCompany} className="company-form">
                            <div className="form-group">
                                <label>Company Name *</label>
                                <input
                                    type="text"
                                    value={newCompany.name}
                                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Description *</label>
                                <textarea
                                    value={newCompany.description}
                                    onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={newCompany.status}
                                    onChange={(e) => setNewCompany({ ...newCompany, status: e.target.value as '' | 'Active' | 'Archived' | 'Pending' })}
                                >
                                    <option value="">(leave blank for default)</option>
                                    <option value="Active">Active</option>
                                    <option value="Archived">Archived</option>
                                    <option value="Pending">Pending</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={newCompany.role}
                                    onChange={(e) => setNewCompany({ ...newCompany, role: e.target.value as '' | 'Admin' | 'Manager' | 'Viewer' })}
                                >
                                    <option value="">(leave blank for default)</option>
                                    <option value="Admin">Admin</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Viewer">Viewer</option>
                                </select>
                            </div>
                            <div className="form-actions">
                                <button type="button" onClick={() => setShowCreateForm(false)} className="cancel-btn">
                                    Cancel
                                </button>
                                <button type="submit" className="create-btn">
                                    Create Company
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Companies Table */}
            <div className="companies-table-container">
                <table className="companies-table">
                    <thead>
                        <tr>
                            <th>Company Name</th>
                            <th>Status</th>
                            <th>Role</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentCompanies.map((company) => (
                            <tr key={company.id}>
                                <td>
                                    <div className="company-info">
                                        <div className="company-name">{company.name}</div>
                                        <div className="company-description">{company.description}</div>
                                    </div>
                                </td>
                                <td>
                                    <span className={`status-badge ${getStatusColor(company.status)}`}>
                                        <span className="status-dot"></span>
                                        {company.status}
                                    </span>
                                </td>
                                <td>
                                    <span className="role-badge">{company.role}</span>
                                </td>
                                <td>
                                    <div className="action-buttons">
                                        <button
                                            className="action-btn edit-btn"
                                            onClick={() => handleEdit(company.id)}
                                            title="Edit"
                                        >
                                            ✏️
                                        </button>
                                        {/* allow any user to delete for now; backend should restrict as needed */}
                                        <button
                                            className="action-btn delete-btn"
                                            onClick={() => handleDelete(company.id)}
                                            title="Delete"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <div className="pagination">
                <button
                    className="pagination-btn"
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                >
                    ‹ Prev
                </button>
                <span className="pagination-info">
                    Page {currentPage} of {totalPages || 1}
                </span>
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

export default Companies;