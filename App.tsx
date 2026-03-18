import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import ContactsView from './components/ContactsView';
import BlastView from './components/BlastView';
import ConnectionView from './components/ConnectionView';
import FileManagerView from './components/FileManagerView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import ScheduledView from './components/ScheduledView';
import ChatView from './components/ChatView';
import LoginView from './components/LoginView';
import RegisterView from './components/RegisterView';
import ForgotPasswordView from './components/ForgotPasswordView';
import { ViewState } from './types';
import { Loader2 } from 'lucide-react';
import { authApi, contactsApi } from './services/api';
import { socketService } from './services/socket';

type AuthView = 'login' | 'register' | 'forgot-password';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [authView, setAuthView] = useState<AuthView>('login');
  const [authError, setAuthError] = useState('');
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [contactCount, setContactCount] = useState<number>(0);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (isLoggedIn) {
      socketService.reconnect();
      loadContactCount();
    } else {
      socketService.disconnect();
    }
  }, [isLoggedIn]);

  useEffect(() => {
    const handleAuthError = () => {
      localStorage.removeItem('authToken');
      localStorage.removeItem('rememberToken');
      setIsLoggedIn(false);
      setAuthView('login');
    };

    socketService.on('auth_error', handleAuthError);
    return () => socketService.off('auth_error', handleAuthError);
  }, []);

  const loadContactCount = async () => {
    try {
      const result = await contactsApi.getAll();
      if (result.success) {
        setContactCount(result.contacts.length);
      }
    } catch {
      // Ignore errors
    }
  };

  const checkAuth = async () => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const oauthToken = searchParams.get('authToken');
      const oauthRememberToken = searchParams.get('rememberToken');
      const oauthError = searchParams.get('authError');

      if (oauthToken) {
        localStorage.setItem('authToken', oauthToken);
        if (oauthRememberToken) {
          localStorage.setItem('rememberToken', oauthRememberToken);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthError('');
        setIsLoggedIn(true);
        setIsCheckingAuth(false);
        return;
      }

      if (oauthError) {
        window.history.replaceState({}, document.title, window.location.pathname);
        setAuthError(oauthError);
      }

      const token = localStorage.getItem('authToken');
      const rememberToken = localStorage.getItem('rememberToken');

      if (token) {
        const result = await authApi.getMe();
        if (result.success) {
          setIsLoggedIn(true);
          setIsCheckingAuth(false);
          return;
        }
      }

      if (rememberToken) {
        try {
          const result = await authApi.loginWithRememberToken(rememberToken);
          if (result.success) {
            localStorage.setItem('authToken', result.token);
            if (result.rememberToken) {
              localStorage.setItem('rememberToken', result.rememberToken);
            }
            setAuthError('');
            setIsLoggedIn(true);
            setIsCheckingAuth(false);
            return;
          }
        } catch {
          localStorage.removeItem('rememberToken');
        }
      }

      localStorage.removeItem('authToken');
      setIsLoggedIn(false);
    } catch {
      localStorage.removeItem('authToken');
      setIsLoggedIn(false);
    } finally {
      setIsCheckingAuth(false);
    }
  };

  const handleLogin = (token: string, rememberToken?: string) => {
    localStorage.setItem('authToken', token);
    if (rememberToken) {
      localStorage.setItem('rememberToken', rememberToken);
    }
    setAuthError('');
    setIsLoggedIn(true);
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout errors
    }
    localStorage.removeItem('authToken');
    localStorage.removeItem('rememberToken');
    setIsLoggedIn(false);
    setAuthView('login');
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={40} className="animate-spin text-emerald-600" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    switch (authView) {
      case 'register':
        return (
          <RegisterView
            onRegister={handleLogin}
            onSwitchToLogin={() => setAuthView('login')}
          />
        );
      case 'forgot-password':
        return (
          <ForgotPasswordView
            onBack={() => setAuthView('login')}
            onPasswordReset={handleLogin}
          />
        );
      default:
        return (
          <LoginView
            onLogin={handleLogin}
            onSwitchToRegister={() => setAuthView('register')}
            onForgotPassword={() => setAuthView('forgot-password')}
            initialError={authError}
          />
        );
    }
  }

  const handleViewChange = (view: ViewState) => {
    setCurrentView(view);
    // Refresh contact count when navigating away from contacts view
    if (currentView === 'contacts' || view === 'contacts') {
      loadContactCount();
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView onChangeView={handleViewChange} />;
      case 'contacts':
        return <ContactsView />;
      case 'blast':
        return <BlastView />;
      case 'connection':
        return <ConnectionView />;
      case 'files':
        return <FileManagerView />;
      case 'scheduled':
        return <ScheduledView />;
      case 'history':
        return <HistoryView />;
      case 'settings':
        return <SettingsView />;
      case 'chat':
        return <ChatView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3F5F7]">
      <div className="hidden md:block sticky top-0 h-screen w-64 shrink-0">
        <Sidebar
          currentView={currentView}
          onChangeView={handleViewChange}
          onLogout={handleLogout}
          contactCount={contactCount}
        />
      </div>

      <div className="flex-1 flex min-h-screen flex-col min-w-0">
        <Header 
          onMenuClick={() => {}} 
          onLogout={handleLogout}
          onChangeView={handleViewChange}
          currentView={currentView}
        />
        <main className="flex-1 overflow-y-auto relative pb-24 md:pb-0">{renderContent()}</main>
      </div>

      <BottomNav currentView={currentView} onChangeView={handleViewChange} contactCount={contactCount} onLogout={handleLogout} />

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default App;
