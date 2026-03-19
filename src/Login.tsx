import React, { useState } from 'react';
import './Login.css';

type Props = {
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
  onLogin: (data: any) => void;
};

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M1 12c1.73-4.39 6-7.5 11-7.5s9.27 3.11 11 7.5c-1.73 4.39-6 7.5-11 7.5S2.73 16.39 1 12z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
  </svg>
);

const EyeOffIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M17.94 17.94C16.23 19.01 14.19 19.7 12 19.7c-7 0-11-7-11-7 1.73-4.39 6-7.5 11-7.5 1.83 0 3.58.38 5.16 1.08"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M1 1l22 22"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M9.53 9.53a3 3 0 0 0 4.24 4.24"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

function Login({ onSwitchToRegister, onSwitchToForgotPassword, onLogin }: Props) {
  const [emailOrPhone, setEmailOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const loginData = { emailOrPhone, password, rememberMe };
    onLogin(loginData);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Investor Finance Tracker System</h1>
          <h2 className="welcome-text">WELCOME!</h2>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Email or Phone"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input password-input"
              required
            />
            <span
              className="visibility-toggle"
              role="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </span>
          </div>

          <div className="form-options">
            <label className="checkbox-container">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span className="checkmark"></span>
              Remember me
            </label>
            <button type="button" className="forgot-password" onClick={onSwitchToForgotPassword}>Forgot Password?</button>
          </div>

          <button type="submit" className="login-button">Login</button>

          <div className="register-link">
            Don't have an account? <button type="button" className="link-button" onClick={onSwitchToRegister}>Register here</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;
