import React, { useEffect, useState } from 'react';
import { LogOut, MoreHorizontal, X } from 'lucide-react';
import { ViewState } from '../types';
import { primaryNavItems, secondaryNavItems } from './Sidebar';

interface BottomNavProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  contactCount?: number;
  onLogout: () => void;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, onChangeView, contactCount, onLogout }) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  useEffect(() => {
    if (!isMoreOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreOpen(false);
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isMoreOpen]);

  const isSecondaryActive = ['scheduled', 'files', 'history', 'settings'].includes(currentView);

  return (
    <>
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/35" onClick={() => setIsMoreOpen(false)} aria-label="Tutup menu tambahan" />
          <div className="absolute inset-x-3 bottom-24 rounded-[2rem] bg-white shadow-2xl border border-gray-200 overflow-hidden animate-[sheetUp_0.22s_ease-out]">
            <div className="px-5 pt-4 pb-3 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-gray-400">Navigasi</p>
                <h3 className="mt-1 text-lg font-semibold text-gray-900">Menu lainnya</h3>
              </div>
              <button onClick={() => setIsMoreOpen(false)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-2 max-h-[65vh] overflow-y-auto">
              {secondaryNavItems.map(item => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onChangeView(item.id);
                      setIsMoreOpen(false);
                    }}
                    className={`w-full flex items-center gap-4 rounded-[1.35rem] px-4 py-3 text-left transition-all ${
                      isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className={`flex h-11 w-11 items-center justify-center rounded-[1rem] ${isActive ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-emerald-700 shadow-sm'}`}>
                      <Icon size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold tracking-[-0.01em]">{item.label}</p>
                      <p className={`text-xs mt-1 ${isActive ? 'text-emerald-700/80' : 'text-gray-500'}`}>{item.description}</p>
                    </div>
                  </button>
                );
              })}

              <button
                onClick={onLogout}
                className="w-full flex items-center gap-4 rounded-[1.35rem] px-4 py-3 text-left transition-all bg-red-50 text-red-600 hover:bg-red-100"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-white text-red-500 shadow-sm">
                  <LogOut size={20} />
                </div>
                <div>
                  <p className="font-semibold">Keluar</p>
                  <p className="text-xs mt-1 text-red-500/80">Akhiri sesi akun dari perangkat ini</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 pointer-events-none">
        <div className="mx-auto mb-3 w-[calc(100%-1rem)] max-w-md rounded-[2rem] border border-gray-200 bg-white px-2 py-2 shadow-[0_18px_45px_rgba(15,23,42,0.12)] pointer-events-auto">
        <div className="grid grid-cols-5 gap-1">
        {primaryNavItems.filter(item => ['dashboard', 'contacts', 'blast', 'chat'].includes(item.id)).map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id)}
                className={`relative flex min-w-0 flex-col items-center justify-center rounded-[1.35rem] px-2 py-2.5 text-[11px] font-medium transition-all ${
                  isActive ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full transition-all">
                  <Icon size={18} strokeWidth={2.1} />
                </div>
                <span className={`mt-1 truncate transition-all ${isActive ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0'} overflow-hidden`}>{item.shortLabel}</span>
                {item.id === 'contacts' && contactCount !== undefined && contactCount > 0 && (
                  <span className={`absolute right-1.5 top-1 min-w-[18px] rounded-full px-1 text-[10px] ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {contactCount > 99 ? '99+' : contactCount}
                  </span>
                )}
              </button>
            );
          })}

          <button
            onClick={() => setIsMoreOpen(true)}
            className={`flex min-w-0 flex-col items-center justify-center rounded-[1.35rem] px-2 py-2.5 text-[11px] font-medium transition-all ${
              isMoreOpen || isSecondaryActive ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full transition-all">
              <MoreHorizontal size={18} strokeWidth={2.1} />
            </div>
            <span className={`mt-1 truncate transition-all ${(isMoreOpen || isSecondaryActive) ? 'opacity-100 max-h-4' : 'opacity-0 max-h-0'} overflow-hidden`}>Lainnya</span>
          </button>
        </div>
        </div>
      </nav>

      <style>{`
        @keyframes sheetUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default BottomNav;
