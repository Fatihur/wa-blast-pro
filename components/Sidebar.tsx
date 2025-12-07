
import React from 'react';
import { LayoutDashboard, Users, Send, Smartphone, History, Settings, LogOut, Zap, X, FolderOpen, Calendar, MessageCircle } from 'lucide-react';
import { ViewState } from '../types';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  onClose?: () => void;
  className?: string;
  contactCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, onClose, className = '', contactCount }) => {
  
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'connection', label: 'Device Connect', icon: Smartphone },
    { id: 'contacts', label: 'Contacts', icon: Users },
    { id: 'chat', label: 'Chat', icon: MessageCircle },
    { id: 'blast', label: 'Send Blast', icon: Send },
    { id: 'scheduled', label: 'Scheduled', icon: Calendar },
    { id: 'files', label: 'File Manager', icon: FolderOpen },
    { id: 'history', label: 'History', icon: History },
  ];

  return (
    <div className={`w-64 bg-white h-full flex flex-col border-r border-gray-200 ${className}`}>
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white font-bold">
            <Zap size={18} fill="white" />
            </div>
            <span className="text-xl font-bold text-gray-800">WA Blast</span>
        </div>
        {onClose && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 md:hidden transition-colors">
                <X size={20} />
            </button>
        )}
      </div>

      <div className="px-4 mb-2">
        <p className="text-xs font-semibold text-gray-400 mb-2 px-2 uppercase tracking-wider">Menu</p>
        <ul className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onChangeView(item.id as ViewState)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-emerald-600'
                  }`}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                  {item.id === 'contacts' && contactCount !== undefined && contactCount > 0 && (
                    <span className="ml-auto text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                      {contactCount > 99 ? '99+' : contactCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="px-4 mt-auto mb-6">
        <p className="text-xs font-semibold text-gray-400 mb-2 px-2 uppercase tracking-wider">General</p>
        <ul className="space-y-1">
          <li>
            <button
              onClick={() => onChangeView('settings')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                currentView === 'settings' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-emerald-600'
              }`}
            >
              <Settings size={20} />
              <span className="font-medium">Settings</span>
            </button>
          </li>
           <li>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </li>
        </ul>

              
      </div>
    </div>
  );
};

export default Sidebar;
