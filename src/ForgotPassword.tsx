import React, { useState, useEffect } from 'react';
import './ForgotPassword.css';

type Props = {
  onSwitchToLogin: () => void;
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


function ForgotPassword({ onSwitchToLogin }: Props) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  // check that backend is reachable; if not, show error immediately
  React.useEffect(() => {
    fetch('/api/health').catch(() => {
      setStatusText('Error connecting to server');
    });
  }, []);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const requestOtp = async () => {
    setSubmitting(true);
    setStatusText(null);
    try {
      const res = await fetch('/api/forgot-password/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusText(data?.message || 'Failed to send OTP');
        return;
      }

      // in development mode the server may return the OTP directly
      const message = data?.message || 'OTP sent to your registered email';
      setStatusText(message);
      if (data?.otp) {
        setDevOtp(data.otp);
        console.log('development OTP:', data.otp);
      } else {
        setDevOtp(null);
      }
      setStep('reset');
    } catch {
      setStatusText('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setStatusText('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setStatusText(null);
    try {
      const res = await fetch('/api/forgot-password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatusText(data?.message || 'Failed to reset password');
        return;
      }

      alert('Password reset successful. Please login.');
      onSwitchToLogin();
    } catch {
      setStatusText('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyOtp = async () => {
    if (!devOtp) return;
    try {
      await navigator.clipboard.writeText(devOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('copy failed', err);
    }
  };

  return (
    <div className="forgot-password-container">
      <div className="forgot-password-card">
        <div className="forgot-password-header">
          <h1 className="forgot-password-title">RESET PASSWORD</h1>
        </div>

        <form
          className="forgot-password-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (step === 'email') requestOtp();
            else resetPassword();
          }}
        >
          <div className="form-group">
            <div className="input-container">
              <input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
                disabled={submitting || step === 'reset'}
              />
            </div>
          </div>

          {step === 'reset' && (
            <>
              <div className="form-group">
                <div className="input-container">
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Enter OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="form-input"
                    required
                    disabled={submitting}
                  />
                </div>
              </div>

              <div className="form-group">
                <div className="input-container">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="form-input password-input"
                    required
                    disabled={submitting}
                  />
                  <span
                    className="visibility-toggle"
                    role="button"
                    aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowNewPassword((v) => !v)}
                  >
                    {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </span>
                </div>
              </div>

              <div className="form-group">
                <div className="input-container">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input password-input"
                    required
                    disabled={submitting}
                  />
                  <span
                    className="visibility-toggle"
                    role="button"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </span>
                </div>
              </div>
            </>
          )}

          {statusText && <div className="status-text">{statusText}</div>}

          {devOtp && (
            <div className="form-group">
              <div className="input-container">
                <input
                  type="text"
                  readOnly
                  value={devOtp}
                  className="form-input"
                  aria-label="Development OTP"
                />
                <button type="button" className="copy-button" onClick={copyOtp}>
                  {copied ? 'Copied' : 'Copy OTP'}
                </button>
              </div>
            </div>
          )}

          {step === 'email' ? (
            <button type="submit" className="verify-email-button" disabled={submitting}>
              {submitting ? 'Sending...' : 'Verify Email'}
            </button>
          ) : (
            <button type="submit" className="verify-email-button" disabled={submitting}>
              {submitting ? 'Saving...' : 'Reset Password'}
            </button>
          )}

          <div className="login-link">
            Remember your password? <button type="button" className="link-button" onClick={onSwitchToLogin}>Login here</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;
