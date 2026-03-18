
import React from 'react';
import { LayoutDashboard, Users, Send, Smartphone, History, Settings, LogOut, Zap, X, FolderOpen, Calendar, MessageCircle } from 'lucide-react';
import { ViewState } from '../types';

export const primaryNavItems: Array<{ id: ViewState; label: string; shortLabel: string; icon: any }> = [
  { id: 'dashboard', label: 'Ringkasan', shortLabel: 'Home', icon: LayoutDashboard },
  { id: 'connection', label: 'Perangkat', shortLabel: 'Device', icon: Smartphone },
  { id: 'contacts', label: 'Kontak', shortLabel: 'Kontak', icon: Users },
  { id: 'chat', label: 'Chat', shortLabel: 'Chat', icon: MessageCircle },
  { id: 'blast', label: 'Blast', shortLabel: 'Blast', icon: Send },
  { id: 'scheduled', label: 'Terjadwal', shortLabel: 'Jadwal', icon: Calendar },
  { id: 'files', label: 'File', shortLabel: 'File', icon: FolderOpen },
  { id: 'history', label: 'Riwayat', shortLabel: 'Riwayat', icon: History },
];

export const secondaryNavItems: Array<{ id: ViewState; label: string; description: string; icon: any }> = [
  { id: 'connection', label: 'Perangkat', description: 'Hubungkan dan kelola sesi WhatsApp', icon: Smartphone },
  { id: 'scheduled', label: 'Blast Terjadwal', description: 'Kelola blast yang dijadwalkan', icon: Calendar },
  { id: 'files', label: 'File Manager', description: 'Akses file media dan hasil pencocokan', icon: FolderOpen },
  { id: 'history', label: 'Riwayat', description: 'Pantau hasil campaign yang sudah berjalan', icon: History },
  { id: 'settings', label: 'Pengaturan', description: 'Atur preferensi aplikasi dan akun', icon: Settings },
];

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  onClose?: () => void;
  className?: string;
  contactCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, onClose, className = '', contactCount }) => {
  
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
          {primaryNavItems.map((item) => {
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
               <span className="font-medium">Pengaturan</span>
            </button>
          </li>
           <li>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-all duration-200"
            >
              <LogOut size={20} />
               <span className="font-medium">Keluar</span>
            </button>
          </li>
        </ul>

              
      </div>
    </div>
  );
};

export default Sidebar;
