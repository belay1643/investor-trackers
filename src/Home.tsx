import React from 'react';
import './Home.css';
import Settings from './Settings';
import Companies from './Companies';
import InvestmentPage from './Investment';
import Transactions from './Transactions';
import Approvals from './Approvals';
import AuditLogs from './AuditLogs';
import Dashboard from './Dashboard';
import Reports from './Reports';


type Props = {
  user: any;
  onLogin: () => void;
  onRegister: () => void;
  onLogout: () => void;
};

// sections that appear in the sidebar / main area. we start on "investments" so
// the app behaves like a normal dashboard rather than dropping straight into
// the settings screen (which was confusing to some users).
export type Section =
  | 'dashboard'
  | 'investments'
  | 'companies'
  | 'transactions'
  | 'approvals'
  | 'reports'
  | 'auditlogs'
  | 'settings';

function Home({ user, onLogin, onRegister, onLogout }: Props) {
  // show dashboard page by default
  const [activeSection, setActiveSection] = React.useState<Section>('dashboard');
  const [currentCompany, setCurrentCompany] = React.useState('');
  const [companies, setCompanies] = React.useState<{ _id?: string; id?: string; name: string }[]>([]);
  const [dashboardMode, setDashboardMode] = React.useState<'single' | 'consolidated'>('single');
  const [profileMenuOpen, setProfileMenuOpen] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    // fetch list of companies for header dropdown
    const load = async () => {
      try {
        const res = await fetch('/api/companies');
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          // ensure names are strings
          const cleaned = data.map((c: any) => ({
            ...c,
            name: c.name || ''
          }));
          setCompanies(cleaned);
          // pick a non-empty name if we don't have one
          if (!currentCompany && cleaned.length) {
            const choice = cleaned.find(c => c.name) || cleaned[0];
            setCurrentCompany(choice.name || '');
          }
        }
      } catch (err) {
        console.error('Error loading companies in Home header:', err);
      }
    };
    load();
  }, []);

  const handleSettings = () => setActiveSection('settings');

  // debug logging so we can trace navigation when things go wrong
  React.useEffect(() => {
    console.log('Home activeSection changed to', activeSection, 'company', currentCompany);
  }, [activeSection, currentCompany]);

  return (
    <div className="home-container">
      {user ? (
        <div className="dashboard-layout">
          {/* Sidebar Navigation */}
          <aside className="sidebar">
            <div className="sidebar-header">
              <div className="logo">
                <div className="logo-icon">🏢</div>
                <span className="logo-text">IFTS</span>
              </div>
            </div>
            <nav className="sidebar-nav">
              <div
                className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}
                onClick={() => setActiveSection('dashboard')}
              >
                <span className="nav-icon">🏠</span>
                Dashboard
              </div>

              <div
                className={`nav-item ${activeSection === 'companies' ? 'active' : ''}`}
                onClick={() => setActiveSection('companies')}
              >
                <span className="nav-icon">🏢</span>
                Companies
              </div>

              <div
                className={`nav-item ${activeSection === 'investments' ? 'active' : ''}`}
                onClick={() => setActiveSection('investments')}
              >
                <span className="nav-icon">💼</span>
                Investments
              </div>

              <div
                className={`nav-item ${activeSection === 'transactions' ? 'active' : ''}`}
                onClick={() => setActiveSection('transactions')}
              >
                <span className="nav-icon">⭕</span>
                Transactions
              </div>

              <div
                className={`nav-item ${activeSection === 'approvals' ? 'active' : ''}`}
                onClick={() => setActiveSection('approvals')}
              >
                <span className="nav-icon">✅</span>
                Approvals
              </div>

              <div
                className={`nav-item ${activeSection === 'reports' ? 'active' : ''}`}
                onClick={() => setActiveSection('reports')}
              >
                <span className="nav-icon">📄</span>
                Reports
              </div>

              <div
                className={`nav-item ${activeSection === 'auditlogs' ? 'active' : ''}`}
                onClick={() => setActiveSection('auditlogs')}
              >
                <span className="nav-icon">📝</span>
                Audit Logs
              </div>

              <div
                className={`nav-item ${activeSection === 'settings' ? 'active' : ''}`}
                onClick={handleSettings}
              >
                <span className="nav-icon">⚙️</span>
                Settings
              </div>
            </nav>
          </aside>

          {/* Main Content */}
          <main className="dashboard-main">
            {/* Top Header */}
            <header className="dashboard-header">
            {activeSection === 'dashboard' && (
              <div className="dashboard-controls-header">
                <div className="switcher">
                  <button
                    className={`switcher-button ${dashboardMode === 'single' ? 'active' : ''}`}
                    onClick={() => {
                      setDashboardMode('single');
                      if (!currentCompany && companies.length) {
                        setCurrentCompany(companies[0].name || '');
                      }
                    }}
                  >
                    Single Company
                  </button>
                  <button
                    className={`switcher-button ${dashboardMode === 'consolidated' ? 'active' : ''}`}
                    onClick={() => {
                      setDashboardMode('consolidated');
                      setCurrentCompany('');
                    }}
                  >
                    Consolidated
                  </button>
                </div>

                {dashboardMode === 'single' && (
                  <select
                    className="company-select"
                    value={currentCompany}
                    onChange={(e) => setCurrentCompany(e.target.value)}
                  >
                    {companies.map((c) => (
                      <option key={c._id || c.id || c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div className="header-actions">
              <div className="user-profile" ref={profileMenuRef} title={user?.fullName || user?.email || 'User'}>
                <button
                  type="button"
                  className="user-profile-button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                >
                  <div className="user-avatar">
                    {user?.profileImage ? (
                      <img src={user.profileImage} alt="User" className="user-avatar-img" />
                    ) : (
                      (user?.fullName || user?.email || 'U')
                        .toString()
                        .trim()
                        .charAt(0)
                        .toUpperCase()
                    )}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user?.fullName || (user?.email?.split('@')[0] || 'User')}</div>
                  </div>
                  <span className="dropdown-arrow">▾</span>
                </button>

                {profileMenuOpen && (
                  <div className="profile-menu">
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setActiveSection('settings');
                      }}
                    >
                      👤 View Profile
                    </button>
                    <button
                      type="button"
                      className="profile-menu-item"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onLogout();
                      }}
                    >
                      🚪 Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

            {/* Dashboard Content */}
            <div className={`dashboard-content section-${activeSection}`}>
              {activeSection === 'dashboard' && (
                  <Dashboard
                    currentCompany={currentCompany}
                    companies={companies}
                    onCompanySwitch={(company) => {
                      setDashboardMode('single');
                      setCurrentCompany(company);
                    }}
                    user={user}
                    viewMode={dashboardMode}
                  />
              )}
              {activeSection === 'investments' && (
                  <InvestmentPage currentCompany={currentCompany} user={user} />
              )}
              {activeSection === 'companies' && (
                  <Companies
                    user={user}
                    currentCompany={currentCompany}
                    onCompanySwitch={setCurrentCompany}
                    onNavigate={(sec) => setActiveSection(sec as Section)}
                  />
              )}
              {activeSection === 'transactions' && (
                  <Transactions currentCompany={currentCompany} />
              )}
              {activeSection === 'approvals' && (
                  <Approvals currentCompany={currentCompany} />
              )}
              {activeSection === 'reports' && (
                  <Reports />
              )}
              {activeSection === 'auditlogs' && (
                  <AuditLogs currentCompany={currentCompany} companies={companies} />
              )}
              {activeSection === 'settings' && (
                  <Settings currentCompany={currentCompany} user={user} />
              )}
            </div>
          </main>
        </div>
      ) : (
        <div className="auth-prompt">
          <h3>Welcome to Investment Tracker</h3>
          <p>Please login or register to access the dashboard.</p>
          <div className="auth-buttons">
            <button className="cta-button login" onClick={onLogin}>Login</button>
            <button className="cta-button register" onClick={onRegister}>Register</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
