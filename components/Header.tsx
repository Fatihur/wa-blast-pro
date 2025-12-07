import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Bell, Mail, Command, Menu, Settings, LogOut, ChevronDown, X, Clock, Users, FileText, Check, CheckCheck, Trash2 } from 'lucide-react';
import { ViewState } from '../types';
import { authApi, AuthUser, headerApi, SearchResult, Notification, InboxMessage } from '../services/api';

interface HeaderProps {
  onMenuClick: () => void;
  onLogout: () => void;
  onChangeView: (view: ViewState) => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogout, onChangeView }) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Inbox state
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);
  const [showInbox, setShowInbox] = useState(false);
  const inboxRef = useRef<HTMLDivElement>(null);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (inboxRef.current && !inboxRef.current.contains(event.target as Node)) {
        setShowInbox(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch user
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

  // Fetch notifications and inbox on mount
  useEffect(() => {
    fetchNotifications();
    fetchInbox();
    const interval = setInterval(() => {
      fetchNotifications();
      fetchInbox();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const result = await headerApi.getNotifications(20);
      if (result.success) {
        setNotifications(result.notifications);
        setNotifUnreadCount(result.unreadCount);
      }
    } catch {
      // Ignore errors
    }
  };

  const fetchInbox = async () => {
    try {
      const result = await headerApi.getInbox(20);
      if (result.success) {
        setInboxMessages(result.messages);
        setInboxUnreadCount(result.unreadCount);
      }
    } catch {
      // Ignore errors
    }
  };

  // Search handler with debounce
  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults(null);
      setShowSearchDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const result = await headerApi.search(query);
      if (result.success) {
        setSearchResults(result.results);
        setShowSearchDropdown(true);
      }
    } catch {
      // Ignore errors
    } finally {
      setIsSearching(false);
    }
  }, []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      handleSearch(value);
    }, 300);
  };

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search-input');
        searchInput?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMarkNotifRead = async (id: string) => {
    try {
      await headerApi.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setNotifUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllNotifRead = async () => {
    try {
      await headerApi.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setNotifUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const handleDeleteNotif = async (id: string) => {
    try {
      await headerApi.deleteNotification(id);
      const deleted = notifications.find(n => n.id === id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      if (deleted && !deleted.is_read) {
        setNotifUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch {
      // Ignore
    }
  };

  const handleMarkInboxRead = async (id: string) => {
    try {
      await headerApi.markInboxRead(id);
      setInboxMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m));
      setInboxUnreadCount(prev => Math.max(0, prev - 1));
    } catch {
      // Ignore
    }
  };

  const handleMarkAllInboxRead = async () => {
    try {
      await headerApi.markAllInboxRead();
      setInboxMessages(prev => prev.map(m => ({ ...m, is_read: true })));
      setInboxUnreadCount(0);
    } catch {
      // Ignore
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    if (diffDays < 7) return `${diffDays} hari lalu`;
    return date.toLocaleDateString('id-ID');
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'blast_completed': return <CheckCheck className="text-emerald-500" size={16} />;
      case 'blast_failed': return <X className="text-red-500" size={16} />;
      case 'blast_started': return <Clock className="text-blue-500" size={16} />;
      case 'session_disconnected': return <X className="text-orange-500" size={16} />;
      case 'scheduled_reminder': return <Clock className="text-purple-500" size={16} />;
      default: return <Bell className="text-gray-500" size={16} />;
    }
  };

  const totalResults = searchResults 
    ? searchResults.contacts.length + searchResults.history.length + searchResults.templates.length
    : 0;

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

        {/* Search Bar */}
        <div className="relative hidden md:block" ref={searchRef}>
          <div className="flex items-center bg-gray-100 rounded-xl px-4 py-2.5 w-96 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
            <Search className="text-gray-400 mr-3" size={20} />
            <input 
              id="global-search-input"
              type="text" 
              placeholder="Cari kontak, riwayat, template..." 
              value={searchQuery}
              onChange={onSearchChange}
              onFocus={() => searchQuery.length >= 2 && setShowSearchDropdown(true)}
              className="bg-transparent border-none outline-none text-gray-700 w-full placeholder-gray-400 text-sm font-medium" 
            />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setSearchResults(null); setShowSearchDropdown(false); }} className="p-1 hover:bg-gray-200 rounded-full mr-2">
                <X size={14} className="text-gray-400" />
              </button>
            )}
            <div className="flex items-center gap-1 px-2 py-0.5 bg-white rounded-md shadow-sm border border-gray-200 text-xs text-gray-500 font-mono">
              <Command size={10} />F
            </div>
          </div>

          {/* Search Dropdown */}
          {showSearchDropdown && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-96 overflow-y-auto z-50">
              {isSearching ? (
                <div className="p-4 text-center text-gray-500 text-sm">Mencari...</div>
              ) : totalResults === 0 ? (
                <div className="p-4 text-center text-gray-500 text-sm">Tidak ada hasil untuk "{searchQuery}"</div>
              ) : (
                <>
                  {/* Contacts Results */}
                  {searchResults && searchResults.contacts.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 flex items-center gap-2">
                        <Users size={14} />
                        KONTAK ({searchResults.contacts.length})
                      </div>
                      {searchResults.contacts.map(contact => (
                        <button
                          key={contact.id}
                          onClick={() => { onChangeView('contacts'); setShowSearchDropdown(false); setSearchQuery(''); }}
                          className="w-full px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 text-left"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-sm font-medium">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">{contact.name}</p>
                            <p className="text-xs text-gray-500">{contact.phone}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* History Results */}
                  {searchResults && searchResults.history.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 flex items-center gap-2">
                        <Clock size={14} />
                        RIWAYAT BLAST ({searchResults.history.length})
                      </div>
                      {searchResults.history.map(item => (
                        <button
                          key={item.id}
                          onClick={() => { onChangeView('history'); setShowSearchDropdown(false); setSearchQuery(''); }}
                          className="w-full px-4 py-2.5 hover:bg-gray-50 text-left"
                        >
                          <p className="text-sm font-medium text-gray-800 truncate">{item.content.substring(0, 50)}...</p>
                          <p className="text-xs text-gray-500">{item.total_recipients} penerima • {formatTimeAgo(item.created_at)}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Templates Results */}
                  {searchResults && searchResults.templates.length > 0 && (
                    <div>
                      <div className="px-4 py-2 bg-gray-50 text-xs font-semibold text-gray-500 flex items-center gap-2">
                        <FileText size={14} />
                        TEMPLATE ({searchResults.templates.length})
                      </div>
                      {searchResults.templates.map(template => (
                        <button
                          key={template.id}
                          onClick={() => { setShowSearchDropdown(false); setSearchQuery(''); }}
                          className="w-full px-4 py-2.5 hover:bg-gray-50 text-left"
                        >
                          <p className="text-sm font-medium text-gray-800">{template.name}</p>
                          <p className="text-xs text-gray-500 truncate">{template.content.substring(0, 60)}...</p>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 md:gap-6">
        {/* Inbox/Messages */}
        <div className="relative" ref={inboxRef}>
          <button 
            onClick={() => { setShowInbox(!showInbox); setShowNotifications(false); }}
            className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500 hidden sm:block"
          >
            <Mail size={20} />
            {inboxUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-blue-500 rounded-full text-white text-xs flex items-center justify-center font-medium px-1">
                {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
              </span>
            )}
          </button>

          {/* Inbox Dropdown */}
          {showInbox && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Pesan Masuk</h3>
                {inboxUnreadCount > 0 && (
                  <button onClick={handleMarkAllInboxRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    Tandai semua dibaca
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {inboxMessages.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Mail size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Belum ada pesan masuk</p>
                  </div>
                ) : (
                  inboxMessages.map(msg => (
                    <div
                      key={msg.id}
                      className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-50 ${!msg.is_read ? 'bg-blue-50/50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium flex-shrink-0">
                          {(msg.from_name || msg.from_phone).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-800 truncate">{msg.from_name || msg.from_phone}</p>
                            <span className="text-xs text-gray-400 flex-shrink-0">{formatTimeAgo(msg.received_at)}</span>
                          </div>
                          <p className="text-xs text-gray-500">{msg.from_phone}</p>
                          <p className="text-sm text-gray-600 truncate mt-0.5">{msg.content}</p>
                        </div>
                        {!msg.is_read && (
                          <button onClick={() => handleMarkInboxRead(msg.id)} className="p-1 hover:bg-gray-200 rounded-full" title="Tandai dibaca">
                            <Check size={14} className="text-emerald-500" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => { setShowNotifications(!showNotifications); setShowInbox(false); }}
            className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
          >
            <Bell size={20} />
            {notifUnreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-medium px-1">
                {notifUnreadCount > 99 ? '99+' : notifUnreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 z-50">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <h3 className="font-semibold text-gray-800">Notifikasi</h3>
                {notifUnreadCount > 0 && (
                  <button onClick={handleMarkAllNotifRead} className="text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                    Tandai semua dibaca
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Bell size={32} className="mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Belum ada notifikasi</p>
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div
                      key={notif.id}
                      className={`px-4 py-3 hover:bg-gray-50 border-b border-gray-50 ${!notif.is_read ? 'bg-emerald-50/50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                          {getNotifIcon(notif.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">{notif.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{notif.message}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatTimeAgo(notif.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!notif.is_read && (
                            <button onClick={() => handleMarkNotifRead(notif.id)} className="p-1 hover:bg-gray-200 rounded-full" title="Tandai dibaca">
                              <Check size={14} className="text-emerald-500" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteNotif(notif.id)} className="p-1 hover:bg-gray-200 rounded-full" title="Hapus">
                            <Trash2 size={14} className="text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
        
        <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

        {/* Profile Menu */}
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
