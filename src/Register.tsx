import React, { useState } from 'react';
import './Register.css';

type Props = {
  onSwitchToLogin: () => void;
  onRegister: (data: any) => void;
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


function Register({ onSwitchToLogin, onRegister }: Props) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);

  const handleProfileImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setProfileFile(null);
      setProfileImage(null);
      return;
    }

    setProfileFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearProfileImage = () => {
    setProfileFile(null);
    setProfileImage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match!');
      return;
    }
    const userData: any = { fullName, email, phoneNumber, password };
    if (profileImage) {
      userData.profileImage = profileImage;
      if (profileFile) userData.profileImageName = profileFile.name;
    }
    // Persist the uploaded profile image in localStorage so it can be restored after login
    if (userData.profileImage) {
      try {
        localStorage.setItem(`profileImage:${userData.email}`, userData.profileImage);
      } catch {
        // ignore storage errors
      }
    }

    onRegister(userData);
  };

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1 className="register-title">Investor Finance Tracker System</h1>
          {profileImage && (
            <div className="header-avatar">
              <img src={profileImage} alt="Profile" className="header-avatar-img" />
              <button
                type="button"
                className="avatar-remove"
                onClick={clearProfileImage}
                aria-label="Remove profile photo"
              >
                ×
              </button>
            </div>
          )}
          <h2 className="register-subtitle">Create Account</h2>
        </div>

        <form className="register-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Full Name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <input
              type="tel"
              placeholder="Phone Number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
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
              {showPassword ? <EyeIcon /> : <EyeOffIcon />}
            </span>
          </div>

          <div className="form-group">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input password-input"
              required
            />
            <span
              className="visibility-toggle"
              role="button"
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowConfirmPassword((v) => !v)}
            >
              {showConfirmPassword ? <EyeIcon /> : <EyeOffIcon />}
            </span>
          </div>

          <button type="submit" className="register-button">Register</button>

          <div className="upload-row">
            <input
              id="profileImage"
              type="file"
              accept="image/*"
              onChange={handleProfileImageChange}
              className="file-input-hidden"
            />
            <label htmlFor="profileImage" className="upload-button">
              Choose Profile Photo (optional)
            </label>
            </div>

          <div className="login-link">
            Already have an account? <button type="button" className="link-button" onClick={onSwitchToLogin}>Login here</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;
