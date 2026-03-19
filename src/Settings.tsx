import React from 'react';
import './Settings.css';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'Admin' | 'Manager' | 'Viewer';
    status: 'Active' | 'Inactive';
}

interface CompanyPreference {
    companyName: string;
    currency: string;
    timezone: string;
    fiscalYearStart: string;
}

interface ApprovalThreshold {
    role: string;
    amount: number;
}

type Props = {
    currentCompany?: string;
    user?: any;
};

function Settings({ currentCompany, user }: Props) {
    const [activeTab, setActiveTab] = React.useState('system');

    // Users State
    const [users, setUsers] = React.useState<User[]>([
        { id: '1', name: 'John Admin', email: 'john@a.com', role: 'Admin', status: 'Active' },
        { id: '2', name: 'Sarah Mgr', email: 'sarah@a.com', role: 'Manager', status: 'Active' },
        { id: '3', name: 'Mike Viewer', email: 'mike@a.com', role: 'Viewer', status: 'Inactive' }
    ]);

    // Company Preferences State
    const [companyPrefs, setCompanyPrefs] = React.useState<CompanyPreference>({
        companyName: currentCompany || '',
        currency: 'ETB',
        timezone: 'UTC+3',
        fiscalYearStart: 'January'
    });

    // Approval Thresholds State
    const [thresholds, setThresholds] = React.useState<ApprovalThreshold[]>([
        { role: 'Manager', amount: 10000 },
        { role: 'Admin', amount: 50000 }
    ]);

    // Notification Settings State
    const [notifications, setNotifications] = React.useState({
        emailAlerts: true,
        smsAlerts: false,
        approvalNotifications: true,
        transactionAlerts: true
    });

    // System Preferences State
    const [twoFactorAuth, setTwoFactorAuth] = React.useState(false);
    const [autoApprove, setAutoApprove] = React.useState(false);
    const [emailNotifications, setEmailNotifications] = React.useState(false);
    const [reportFormat, setReportFormat] = React.useState('PDF');
    const [backupFrequency, setBackupFrequency] = React.useState('Daily');

    // Backup State
    const [lastBackup, setLastBackup] = React.useState('2024-01-15 10:30 AM');
    const [autoBackup, setAutoBackup] = React.useState(true);

    const handleSaveSettings = () => {
        alert('Settings saved successfully!');
    };

    const handleBackupNow = () => {
        const now = new Date().toLocaleString();
        setLastBackup(now);
        alert('Backup completed successfully!');
    };

    const handleAddUser = () => {
        const name = prompt('Enter user name:');
        const email = prompt('Enter user email:');
        if (name && email) {
            const newUser: User = {
                id: String(users.length + 1),
                name,
                email,
                role: 'Viewer',
                status: 'Active'
            };
            setUsers([...users, newUser]);
            alert('User added successfully!');
        }
    };

    const handleSaveCompanyPrefs = () => {
        alert('Company preferences saved successfully!');
    };

    const handleAddThreshold = () => {
        const role = prompt('Enter role (Manager/Admin):');
        const amount = prompt('Enter threshold amount:');
        if (role && amount) {
            setThresholds([...thresholds, { role, amount: Number(amount) }]);
            alert('Threshold added successfully!');
        }
    };

    const handleSaveNotifications = () => {
        alert('Notification settings saved successfully!');
    };

    // Render System Tab (USER MANAGEMENT + SYSTEM PREFERENCES)
    const renderSystemTab = () => (
        <div className="settings-section">
            {user && (
                <div className="profile-summary">
                    <div className="profile-avatar">
                        {user.profileImage ? (
                            <img src={user.profileImage} alt="Profile" />
                        ) : (
                            <div className="profile-initial">
                                {((user.fullName || user.email || 'U') as string).trim().charAt(0).toUpperCase()}
                            </div>
                        )}
                    </div>
                    <div className="profile-details">
                        <div className="profile-name">{user.fullName || (user.email?.split('@')[0] || 'User')}</div>
                        <div className="profile-email">{user.email}</div>
                    </div>
                </div>
            )}
            <h3>USER MANAGEMENT</h3>
            <div className="section-actions">
                <button className="add-btn" onClick={handleAddUser}>+ Add User</button>
                <input type="text" placeholder="Search" className="search-input" />
            </div>
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map(user => (
                        <tr key={user.id}>
                            <td>{user.name}</td>
                            <td>{user.email}</td>
                            <td>{user.role}</td>
                            <td>
                                <span className={`status-indicator ${user.status.toLowerCase()}`}>
                                    {user.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <h3 style={{ marginTop: '2rem' }}>SYSTEM PREFERENCES</h3>
            <div className="preferences-form">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={twoFactorAuth}
                        onChange={(e) => setTwoFactorAuth(e.target.checked)}
                    />
                    Enable Two-Factor Authentication
                </label>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={autoApprove}
                        onChange={(e) => setAutoApprove(e.target.checked)}
                    />
                    Auto-approve transactions under Br 10,000
                </label>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={emailNotifications}
                        onChange={(e) => setEmailNotifications(e.target.checked)}
                    />
                    Send email notifications for approvals
                </label>

                <div className="form-row">
                    <div className="form-group">
                        <label>Default Report Format:</label>
                        <select
                            value={reportFormat}
                            onChange={(e) => setReportFormat(e.target.value)}
                        >
                            <option value="PDF">PDF</option>
                            <option value="Excel">Excel</option>
                            <option value="CSV">CSV</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Backup Frequency:</label>
                        <select
                            value={backupFrequency}
                            onChange={(e) => setBackupFrequency(e.target.value)}
                        >
                            <option value="Daily">Daily</option>
                            <option value="Weekly">Weekly</option>
                            <option value="Monthly">Monthly</option>
                        </select>
                    </div>
                </div>

                <div className="form-actions">
                    <button className="save-btn" onClick={handleSaveSettings}>Save Settings</button>
                    <button className="backup-btn" onClick={handleBackupNow}>Backup Now</button>
                </div>
            </div>
        </div>
    );

    // Render Users Tab (Role Management)
    const renderUsersTab = () => (
        <div className="settings-section">
            <h3>ROLE MANAGEMENT</h3>
            <p>Manage user roles and permissions for the system</p>
            <div className="role-list">
                <div className="role-item">
                    <h4>Admin</h4>
                    <p>Full system access, can manage all settings and users</p>
                </div>
                <div className="role-item">
                    <h4>Manager</h4>
                    <p>Can approve transactions, manage company data</p>
                </div>
                <div className="role-item">
                    <h4>Viewer</h4>
                    <p>Read-only access to reports and data</p>
                </div>
            </div>
        </div>
    );

    // Render Roles Tab (Company Preferences)
    const renderRolesTab = () => (
        <div className="settings-section">
            <h3>COMPANY PREFERENCES</h3>
            {!currentCompany ? (
                <p className="warning-text">No company selected. Please select a company first.</p>
            ) : (
                <div className="preferences-form">
                    <div className="form-group">
                        <label>Company Name:</label>
                        <input
                            type="text"
                            value={companyPrefs.companyName}
                            onChange={(e) => setCompanyPrefs({ ...companyPrefs, companyName: e.target.value })}
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Default Currency:</label>
                            <select
                                value={companyPrefs.currency}
                                onChange={(e) => setCompanyPrefs({ ...companyPrefs, currency: e.target.value })}
                            >
                                <option value="ETB">ETB (Ethiopian Birr)</option>
                                <option value="USD">USD (US Dollar)</option>
                                <option value="EUR">EUR (Euro)</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Timezone:</label>
                            <select
                                value={companyPrefs.timezone}
                                onChange={(e) => setCompanyPrefs({ ...companyPrefs, timezone: e.target.value })}
                            >
                                <option value="UTC+3">UTC+3 (East Africa)</option>
                                <option value="UTC">UTC</option>
                                <option value="UTC-5">UTC-5 (EST)</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-group">
                        <label>Fiscal Year Start:</label>
                        <select
                            value={companyPrefs.fiscalYearStart}
                            onChange={(e) => setCompanyPrefs({ ...companyPrefs, fiscalYearStart: e.target.value })}
                        >
                            <option value="January">January</option>
                            <option value="July">July (Ethiopian Calendar)</option>
                            <option value="April">April</option>
                        </select>
                    </div>
                    <button className="save-btn" onClick={handleSaveCompanyPrefs}>Save Preferences</button>
                </div>
            )}
        </div>
    );

    // Render Companies Tab (Approval Thresholds)
    const renderCompaniesTab = () => (
        <div className="settings-section">
            <h3>APPROVAL THRESHOLD CONFIGURATION</h3>
            <p>Set approval thresholds for different roles</p>
            <button className="add-btn" onClick={handleAddThreshold} style={{ marginBottom: '1rem' }}>
                + Add Threshold
            </button>
            <table className="users-table">
                <thead>
                    <tr>
                        <th>Role</th>
                        <th>Threshold Amount (Br)</th>
                    </tr>
                </thead>
                <tbody>
                    {thresholds.map((threshold, index) => (
                        <tr key={index}>
                            <td>{threshold.role}</td>
                            <td>Br {threshold.amount.toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    // Render Notification Settings
    const renderNotificationsTab = () => (
        <div className="settings-section">
            <h3>NOTIFICATION SETTINGS</h3>
            <div className="preferences-form">
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={notifications.emailAlerts}
                        onChange={(e) => setNotifications({ ...notifications, emailAlerts: e.target.checked })}
                    />
                    Email Alerts
                </label>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={notifications.smsAlerts}
                        onChange={(e) => setNotifications({ ...notifications, smsAlerts: e.target.checked })}
                    />
                    SMS Alerts
                </label>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={notifications.approvalNotifications}
                        onChange={(e) => setNotifications({ ...notifications, approvalNotifications: e.target.checked })}
                    />
                    Approval Notifications
                </label>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={notifications.transactionAlerts}
                        onChange={(e) => setNotifications({ ...notifications, transactionAlerts: e.target.checked })}
                    />
                    Transaction Alerts
                </label>
                <button className="save-btn" onClick={handleSaveNotifications}>Save Notification Settings</button>
            </div>
        </div>
    );

    // Render Backup Tab
    const renderBackupTab = () => (
        <div className="settings-section">
            <h3>BACKUP CONTROLS (ADMIN)</h3>
            <div className="preferences-form">
                <div className="backup-info">
                    <p><strong>Last Backup:</strong> {lastBackup}</p>
                    <p><strong>Backup Location:</strong> /backups/tracker11</p>
                </div>
                <label className="checkbox-label">
                    <input
                        type="checkbox"
                        checked={autoBackup}
                        onChange={(e) => setAutoBackup(e.target.checked)}
                    />
                    Enable Automatic Backups
                </label>
                <div className="form-group">
                    <label>Backup Frequency:</label>
                    <select
                        value={backupFrequency}
                        onChange={(e) => setBackupFrequency(e.target.value)}
                    >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                    </select>
                </div>
                <div className="form-actions">
                    <button className="save-btn" onClick={handleSaveSettings}>Save Backup Settings</button>
                    <button className="backup-btn" onClick={handleBackupNow}>Backup Now</button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="settings-container">
            <div className="settings-header">
                <h2>Settings</h2>
                <p>System Configuration</p>
            </div>
            <div className="settings-tabs">
                <button
                    className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    Users
                </button>
                <button
                    className={`tab-btn ${activeTab === 'roles' ? 'active' : ''}`}
                    onClick={() => setActiveTab('roles')}
                >
                    Roles
                </button>
                <button
                    className={`tab-btn ${activeTab === 'companies' ? 'active' : ''}`}
                    onClick={() => setActiveTab('companies')}
                >
                    Companies
                </button>
                <button
                    className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
                    onClick={() => setActiveTab('system')}
                >
                    System
                </button>
                <button
                    className={`tab-btn ${activeTab === 'backup' ? 'active' : ''}`}
                    onClick={() => setActiveTab('backup')}
                >
                    Backup
                </button>
            </div>

            <div className="settings-content">
                {activeTab === 'users' && renderUsersTab()}
                {activeTab === 'roles' && renderRolesTab()}
                {activeTab === 'companies' && renderCompaniesTab()}
                {activeTab === 'system' && renderSystemTab()}
                {activeTab === 'backup' && renderBackupTab()}
            </div>
        </div>
    );
}

export default Settings;
