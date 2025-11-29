import React, { useState, useRef, useEffect } from 'react';
import { Search, Bell, Mail, Command, Menu, Settings, LogOut, ChevronDown } from 'lucide-react';
import { ViewState } from '../types';
import { authApi, AuthUser } from '../services/api';

interface HeaderProps {
  onMenuClick: () => void;
  onLogout: () => void;
  onChangeView: (view: ViewState) => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogout, onChangeView }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const result = await authApi.getMe();
        if (result.success) {
          setUser(result.user);
        }
      } catch {
        // Ignore errors
      }
    };
    fetchUser();
  }, []);
  return (
    <div className="h-16 md:h-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20">
      
      <div className="flex items-center gap-4">
          {/* Mobile Menu Button */}
          <button 
            onClick={onMenuClick}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-600 md:hidden"
          >
              <Menu size={24} />
          </button>

          {/* Search Bar - Hidden on Mobile */}
          <div className="hidden md:flex items-center bg-gray-100 rounded-xl px-4 py-2.5 w-96 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <Search className="text-gray-400 mr-3" size={20} />
            <input 
                type="text" 
                placeholder="Search task" 
                className="bg-transparent border-none outline-none text-gray-700 w-full placeholder-gray-400 text-sm font-medium" 
            />
            <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-md shadow-sm border border-gray-200 text-xs text-gray-500 font-mono">
                <Command size={10} />F
            </div>
          </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 md:gap-6">
          <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hidden sm:block">
              <Mail size={20} />
          </button>
          <button className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
              <Bell size={20} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
          
          <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

          <div className="relative" ref={profileMenuRef}>
            <button 
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-3 pl-2 hover:bg-gray-50 rounded-xl p-2 transition-colors"
            >
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-emerald-100 bg-emerald-500 flex items-center justify-center text-white font-bold text-sm md:text-base">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="hidden md:block text-left">
                  <h4 className="text-sm font-bold text-gray-800 leading-tight">{user?.name || 'User'}</h4>
                  <p className="text-xs text-gray-500">{user?.email || ''}</p>
              </div>
              <ChevronDown size={16} className={`text-gray-400 hidden md:block transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                <button
                  onClick={() => {
                    onChangeView('settings');
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Settings size={18} />
                  <span className="text-sm font-medium">Settings</span>
                </button>
                <div className="h-px bg-gray-100 my-1"></div>
                <button
                  onClick={() => {
                    onLogout();
                    setIsProfileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-red-500 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="text-sm font-medium">Logout</span>
                </button>
              </div>
            )}
          </div>
      </div>
    </div>
  );
};

export default Header;