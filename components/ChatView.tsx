import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle,
  Search,
  RefreshCw,
  Loader2,
  Users,
  User,
  Pin,
  Archive,
  BellOff,
  MoreVertical,
  Send,
  ArrowLeft,
  CheckCheck,
  Trash2,
  VolumeX,
  Volume2,
  MailOpen,
  AlertCircle,
  Eraser,
} from 'lucide-react';
import { chatApi, whatsappApi, ChatInfo, ChatMessage } from '../services/api';
import ConfirmModal from './ConfirmModal';

const ChatView: React.FC = () => {
  const [chats, setChats] = useState<ChatInfo[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'groups'>('all');
  const [showChatMenu, setShowChatMenu] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionChatId, setActionChatId] = useState<string | null>(null);
  const [waStatus, setWaStatus] = useState<string>('DISCONNECTED');
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'danger' | 'warning' | 'info';
    confirmText: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeConfirmModal = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }));
  };

  const syncSelectedChat = useCallback((nextChats: ChatInfo[]) => {
    setSelectedChat(prev => {
      if (!prev) return null;
      return nextChats.find(chat => chat.id === prev.id) || prev;
    });
  }, []);

  const loadChats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await chatApi.getAll();
      if (result.success) {
        setChats(result.chats);
        syncSelectedChat(result.chats);
      }
    } catch (err: any) {
      console.error('Failed to load chats:', err);
      setError(err.message || 'Failed to load chats');
    } finally {
      setIsLoading(false);
    }
  }, [syncSelectedChat]);

  const loadMessages = useCallback(async (chat: ChatInfo, silent = false) => {
    if (!silent) {
      setIsLoadingMessages(true);
    }

    try {
      const result = await chatApi.fetchMessages(chat.id, 50);
      if (result.success) {
        setMessages(result.messages);
        if (!silent) {
          try {
            const seenResult = await chatApi.sendSeen(chat.id);
            setChats(prev =>
              prev.map(item =>
                item.id === chat.id ? { ...item, unreadCount: 0 } : item
              )
            );
            setSelectedChat(prev =>
              prev && prev.id === chat.id ? { ...prev, unreadCount: 0 } : prev
            );
            if (!seenResult.success) {
              console.warn('sendSeen returned non-success result for chat', chat.id);
            }
          } catch (seenError) {
            console.warn('sendSeen failed for chat', chat.id, seenError);
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err);
      setError(err.message || 'Failed to load messages');
    } finally {
      if (!silent) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await whatsappApi.getStatus();
        setWaStatus(status.status);
        setWaConnected(status.status === 'READY' || status.status === 'AUTHENTICATED' || status.status === 'CONNECTING');
      } catch {
        setWaConnected(false);
        setWaStatus('DISCONNECTED');
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (waConnected) {
      loadChats();
    }
  }, [waConnected, loadChats]);

  useEffect(() => {
    if (!selectedChat) return;

    const interval = setInterval(() => {
      loadMessages(selectedChat, true);
    }, 15000);

    return () => clearInterval(interval);
  }, [selectedChat, loadMessages]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowChatMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      inputRef.current?.focus();
    }
  }, [selectedChat]);

  const handleSelectChat = async (chat: ChatInfo) => {
    setSelectedChat(chat);
    setShowChatMenu(null);
    setError(null);
    await loadMessages(chat);
  };

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedChat || !newMessage.trim() || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      await chatApi.sendTyping(selectedChat.id);
      const result = await chatApi.sendMessage(selectedChat.id, newMessage.trim());
      if (result.success) {
        setNewMessage('');
        await Promise.all([loadMessages(selectedChat), loadChats()]);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
      setError(err.message || 'Failed to send message');
    } finally {
      setIsSending(false);
      try {
        if (selectedChat) {
          await chatApi.clearState(selectedChat.id);
        }
      } catch {
        // Ignore clear-state failures
      }
    }
  };

  const handleChatAction = async (chat: ChatInfo, action: () => Promise<void>, message?: string) => {
    setActionChatId(chat.id);
    setError(null);
    try {
      await action();
      await loadChats();
      if (selectedChat?.id === chat.id) {
        const refreshedChat = await chatApi.getById(chat.id);
        if (refreshedChat.success) {
          setSelectedChat(refreshedChat.chat);
        }
      }
      if (message) {
        setError(message);
      }
      setShowChatMenu(null);
    } catch (err: any) {
      console.error('Failed chat action:', err);
      setError(err.message || 'Failed to update chat');
    } finally {
      setActionChatId(null);
    }
  };

  const handleDelete = (chat: ChatInfo) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${chat.name}?`,
      message: 'This will remove the chat from WhatsApp. This action cannot be undone.',
      variant: 'danger',
      confirmText: 'Delete Chat',
      onConfirm: async () => {
        closeConfirmModal();
        await handleChatAction(chat, async () => {
          await chatApi.delete(chat.id);
          if (selectedChat?.id === chat.id) {
            setSelectedChat(null);
            setMessages([]);
          }
        });
      },
    });
  };

  const handleClearMessages = (chat: ChatInfo) => {
    setConfirmModal({
      isOpen: true,
      title: `Clear messages in ${chat.name}?`,
      message: 'This will clear the message history for this chat on WhatsApp.',
      variant: 'warning',
      confirmText: 'Clear Messages',
      onConfirm: async () => {
        closeConfirmModal();
        await handleChatAction(chat, async () => {
          await chatApi.clearMessages(chat.id);
          if (selectedChat?.id === chat.id) {
            setMessages([]);
          }
        });
      },
    });
  };

  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase());
      if (activeTab === 'unread') return matchesSearch && chat.unreadCount > 0;
      if (activeTab === 'groups') return matchesSearch && chat.isGroup;
      return matchesSearch;
    });
  }, [activeTab, chats, searchTerm]);

  const sortedChats = useMemo(() => {
    return [...filteredChats].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [filteredChats]);

  const formatTime = (timestamp: number) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' });
  };

  if (!waConnected) {
    return (
        <div className="p-4 md:p-6 pb-28 md:pb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle size={32} className="text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">WhatsApp belum terhubung</h3>
            <p className="text-gray-500 text-center max-w-md">
              Hubungkan perangkat WhatsApp terlebih dahulu untuk membuka daftar chat dan membalas pesan.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (waStatus !== 'READY') {
    return (
        <div className="p-4 md:p-6 pb-28 md:pb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
              <Loader2 size={32} className="text-blue-600 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">WhatsApp masih menyinkronkan data</h3>
            <p className="text-gray-500 text-center max-w-md">
              Autentikasi perangkat sudah berhasil, tetapi sesi chat belum sepenuhnya siap. Tunggu sebentar lalu coba lagi.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 h-full pb-28 md:pb-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-180px)] md:h-[calc(100vh-140px)] flex overflow-hidden">
        <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Chats</h2>
              <button onClick={loadChats} disabled={isLoading} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari chat..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex gap-2 mt-3">
              {(['all', 'unread', 'groups'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {tab === 'all' ? 'Semua' : tab === 'unread' ? 'Belum dibaca' : 'Grup'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" ref={menuRef}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
              </div>
            ) : sortedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <MessageCircle size={48} className="mb-2 opacity-50" />
                <p>Chat tidak ditemukan</p>
              </div>
            ) : (
              sortedChats.map(chat => (
                <div
                  key={chat.id}
                  className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${selectedChat?.id === chat.id ? 'bg-emerald-50' : ''}`}
                  onClick={() => handleSelectChat(chat)}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${chat.isGroup ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                    {chat.isGroup ? <Users size={20} className="text-blue-600" /> : <User size={20} className="text-emerald-600" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {chat.pinned && <Pin size={12} className="text-gray-400" />}
                        {chat.isMuted && <BellOff size={12} className="text-gray-400" />}
                        {chat.archived && <Archive size={12} className="text-gray-400" />}
                        <span className="font-medium text-gray-800 truncate">{chat.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTime(chat.timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 truncate pr-2">{chat.lastMessage?.body || 'Belum ada pesan'}</p>
                      {chat.unreadCount > 0 && <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">{chat.unreadCount}</span>}
                    </div>
                  </div>

                  <button
                    onClick={event => {
                      event.stopPropagation();
                      setShowChatMenu(showChatMenu === chat.id ? null : chat.id);
                    }}
                    className="p-1 rounded-lg hover:bg-gray-200 text-gray-400"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {showChatMenu === chat.id && (
                    <div className="absolute right-4 top-12 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[160px]">
                      <button onClick={event => { event.stopPropagation(); handleChatAction(chat, async () => { chat.pinned ? await chatApi.unpin(chat.id) : await chatApi.pin(chat.id); }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Pin size={14} />
                          {chat.pinned ? 'Lepas pin' : 'Pin'}
                      </button>
                      <button onClick={event => { event.stopPropagation(); handleChatAction(chat, async () => { chat.archived ? await chatApi.unarchive(chat.id) : await chatApi.archive(chat.id); }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        <Archive size={14} />
                          {chat.archived ? 'Buka arsip' : 'Arsipkan'}
                      </button>
                      <button onClick={event => { event.stopPropagation(); handleChatAction(chat, async () => { chat.isMuted ? await chatApi.unmute(chat.id) : await chatApi.mute(chat.id); }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        {chat.isMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                          {chat.isMuted ? 'Nyalakan suara' : 'Bisukan'}
                      </button>
                      <button onClick={event => { event.stopPropagation(); handleChatAction(chat, async () => { await chatApi.markUnread(chat.id); }); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                        <MailOpen size={14} />
                        Tandai belum dibaca
                      </button>
                      <button onClick={event => { event.stopPropagation(); handleClearMessages(chat); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-orange-600">
                        <Eraser size={14} />
                        Hapus isi chat
                      </button>
                      <button onClick={event => { event.stopPropagation(); handleDelete(chat); }} className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-500">
                        <Trash2 size={14} />
                        Hapus chat
                      </button>
                    </div>
                  )}

                  {actionChatId === chat.id && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
                      <Loader2 size={18} className="animate-spin text-emerald-600" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`flex-1 flex flex-col ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
          {selectedChat ? (
            <>
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <button onClick={() => setSelectedChat(null)} className="md:hidden p-2 rounded-lg hover:bg-gray-100">
                  <ArrowLeft size={20} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${selectedChat.isGroup ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                  {selectedChat.isGroup ? <Users size={18} className="text-blue-600" /> : <User size={18} className="text-emerald-600" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{selectedChat.name}</h3>
                  <p className="text-xs text-gray-500">{selectedChat.isGroup ? 'Grup' : 'Chat pribadi'}</p>
                </div>
                <button onClick={() => loadMessages(selectedChat)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
                  <RefreshCw size={18} className={isLoadingMessages ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin text-emerald-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageCircle size={48} className="mb-2" />
                    <p>Belum ada pesan</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map(message => (
                      <div key={message.id} className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl ${message.fromMe ? 'bg-emerald-500 text-white rounded-br-md' : 'bg-white text-gray-800 rounded-bl-md shadow-sm'}`}>
                          <p className="whitespace-pre-wrap break-words">{message.body || '[Media]'}</p>
                          <div className={`flex items-center gap-1 justify-end mt-1 ${message.fromMe ? 'text-emerald-100' : 'text-gray-400'}`}>
                            <span className="text-xs">{formatTime(message.timestamp)}</span>
                            {message.fromMe && <CheckCheck size={14} />}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Tulis pesan..."
                    value={newMessage}
                    onChange={event => setNewMessage(event.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={isSending}
                  />
                  <button type="submit" disabled={!newMessage.trim() || isSending} className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                    {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageCircle size={64} className="mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Pilih chat</h3>
              <p className="text-sm text-center px-6">Pilih percakapan di panel kiri untuk mulai membaca atau membalas pesan.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirmModal}
      />
    </div>
  );
};

export default ChatView;
