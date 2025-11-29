import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './components/DashboardView';
import ContactsView from './components/ContactsView';
import BlastView from './components/BlastView';
import ConnectionView from './components/ConnectionView';
import FileManagerView from './components/FileManagerView';
import HistoryView from './components/HistoryView';
import SettingsView from './components/SettingsView';
import ScheduledView from './components/ScheduledView';
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
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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
          />
        );
    }
  }

  const handleViewChange = (view: ViewState) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
    // Refresh contact count when navigating away from contacts view
    if (currentView === 'contacts' || view === 'contacts') {
      loadContactCount();
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
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
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F3F5F7]">
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-black/50 transition-opacity backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
          <div className="relative flex-1 flex flex-col max-w-[260px] w-full bg-white h-full shadow-2xl animate-[slideIn_0.3s_ease-out]">
            <Sidebar
              currentView={currentView}
              onChangeView={handleViewChange}
              onLogout={handleLogout}
              onClose={() => setIsMobileMenuOpen(false)}
              className="w-full border-none"
              contactCount={contactCount}
            />
          </div>
        </div>
      )}

      <div className="hidden md:block sticky top-0 h-screen w-64 shrink-0">
        <Sidebar
          currentView={currentView}
          onChangeView={setCurrentView}
          onLogout={handleLogout}
          contactCount={contactCount}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        <Header 
          onMenuClick={() => setIsMobileMenuOpen(true)} 
          onLogout={handleLogout}
          onChangeView={handleViewChange}
        />
        <main className="flex-1 overflow-y-auto relative">{renderContent()}</main>
      </div>

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
