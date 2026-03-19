import React from 'react';
import './LandingPage.css';

type Props = {
  onLogin: () => void;
  onRegister: () => void;
};

function LandingPage({ onLogin, onRegister }: Props) {
  return (
    <div className="landing-container">
      {/* Hero Section */}
      <section className="hero-section">
        <nav className="navbar">
          <div className="nav-content">
            <h1 className="nav-logo">InvestorTracker</h1>
            <div className="nav-buttons">
              <button className="nav-btn login" onClick={onLogin}>Login</button>
              <button className="nav-btn register" onClick={onRegister}>Get Started</button>
            </div>
          </div>
        </nav>

        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">Track Your Investments Like a Pro</h1>
            <p className="hero-subtitle">
              Monitor your portfolio, analyze market trends, and make smarter investment decisions with our comprehensive tracking platform.
            </p>
            <div className="hero-buttons">
              <button className="hero-btn primary" onClick={onRegister}>Start Free Trial</button>
              <button className="hero-btn secondary" onClick={onLogin}>Sign In</button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="chart-preview">
              <div className="chart-line"></div>
              <div className="chart-dots">
                <span></span><span></span><span></span><span></span><span></span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <div className="container">
          <h2 className="section-title">Powerful Features for Smart Investors</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📊</div>
              <h3>Portfolio Tracking</h3>
              <p>Monitor all your investments in one place with real-time updates and comprehensive analytics.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📈</div>
              <h3>Market Analysis</h3>
              <p>Get detailed market insights, trends, and predictions to make informed investment decisions.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔔</div>
              <h3>Smart Alerts</h3>
              <p>Receive personalized notifications about price changes, news, and investment opportunities.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Mobile Access</h3>
              <p>Access your portfolio anytime, anywhere with our responsive mobile-friendly interface.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Secure Platform</h3>
              <p>Your data is protected with bank-level security and encryption for complete peace of mind.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">📝</div>
              <h3>Transaction History</h3>
              <p>Keep detailed records of all your buys, sells, and dividends for tax and analysis purposes.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-grid">
            <div className="stat-item">
              <h3 className="stat-number">$2.5M+</h3>
              <p className="stat-label">Assets Tracked</p>
            </div>
            <div className="stat-item">
              <h3 className="stat-number">50K+</h3>
              <p className="stat-label">Active Users</p>
            </div>
            <div className="stat-item">
              <h3 className="stat-number">99.9%</h3>
              <p className="stat-label">Uptime</p>
            </div>
            <div className="stat-item">
              <h3 className="stat-number">4.9★</h3>
              <p className="stat-label">User Rating</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Take Control of Your Investments?</h2>
            <p>Join thousands of investors who trust our platform for their portfolio management.</p>
            <button className="cta-btn" onClick={onRegister}>Start Your Free Trial</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-section">
              <h3>InvestorTracker</h3>
              <p>Your trusted partner for smart investment tracking and portfolio management.</p>
            </div>
            <div className="footer-section">
              <h4>Product</h4>
              <ul>
                <li><a href="#">Features</a></li>
                <li><a href="#">Pricing</a></li>
                <li><a href="#">Security</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Company</h4>
              <ul>
                <li><a href="#">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </div>
            <div className="footer-section">
              <h4>Legal</h4>
              <ul>
                <li><a href="#">Privacy</a></li>
                <li><a href="#">Terms</a></li>
                <li><a href="#">Compliance</a></li>
              </ul>
            </div>
          </div>
          <div className="footer-bottom">
            <p>&copy; 2024 InvestorTracker. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
