import { useEffect, useState } from 'react';
import Login from './Login';
import Register from './Register';
import ForgotPassword from './ForgotPassword';
import Home from './Home';
import LandingPage from './LandingPage';

function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'register' | 'forgotPassword' | 'dashboard'>('landing');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
    if (saved === 'dark' || saved === 'light') return saved as 'light' | 'dark';
    const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    const el = document.body;
    el.classList.remove('theme-light', 'theme-dark');
    el.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    try {
      localStorage.setItem('theme', theme);
    } catch {}
  }, [theme]);

  const switchToRegister = () => setCurrentView('register');
  const switchToLogin = () => setCurrentView('login');
  const switchToForgotPassword = () => setCurrentView('forgotPassword');

  const handleLogout = () => {
    // attempt server-side logout (if session/cookie exists)
    fetch('/api/logout', { method: 'POST' }).catch(() => {});

    setCurrentUser(null);
    // after logout go back to login screen directly
    setCurrentView('login');
    // reload page to ensure any stale state cleared
    setTimeout(() => {
      window.location.reload();
    }, 100);
  };

  const handleRegister = async (userData: any) => {
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: userData.fullName,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          password: userData.password
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || 'Registration failed');
        return;
      }
      alert('Registration successful! Please login with your credentials.');
      switchToLogin();
    } catch {
      alert('Network error. Please try again.');
    }
  };

  const handleLogin = async (loginData: any) => {
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrPhone: loginData.emailOrPhone,
          password: loginData.password
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.message || 'Invalid credentials');
        return;
      }

      // Restore locally stored profile image (from registration) if available.
      const rawKey = loginData.emailOrPhone?.toString().trim();
      const imageKey = rawKey ? `profileImage:${rawKey}` : null;
      const storedImage = imageKey ? localStorage.getItem(imageKey) : null;

      const userWithImage = {
        ...(data?.user || {}),
        profileImage: storedImage || data?.user?.profileImage || null,
      };

      setCurrentUser(userWithImage);
      setCurrentView('dashboard');
    } catch {
      alert('Network error. Please try again.');
    }
  };

  return (
    <>
      {currentView === 'landing' && (
        <LandingPage
          onLogin={switchToLogin}
          onRegister={switchToRegister}
        />
      )}

      {currentView === 'dashboard' && (
        <Home
          user={currentUser}
          onLogin={() => setCurrentView('login')}
          onRegister={() => setCurrentView('register')}
          onLogout={handleLogout}
        />
      )}

      {currentView === 'login' && (
        <Login
          onSwitchToRegister={switchToRegister}
          onSwitchToForgotPassword={switchToForgotPassword}
          onLogin={handleLogin}
        />
      )}

      {currentView === 'register' && (
        <Register
          onSwitchToLogin={switchToLogin}
          onRegister={handleRegister}
        />
      )}

      {currentView === 'forgotPassword' && (
        <ForgotPassword onSwitchToLogin={switchToLogin} />
      )}
    </>
  );
}

export default App;
