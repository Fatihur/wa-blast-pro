import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageCircle, Search, RefreshCw, Loader2, Users, User, 
  Pin, Archive, BellOff, MoreVertical, Send, ArrowLeft, 
  Check, CheckCheck, Clock, Trash2, VolumeX, Volume2
} from 'lucide-react';
import { chatApi, whatsappApi, ChatInfo, ChatMessage } from '../services/api';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadChats = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await chatApi.getAll();
      if (result.success) {
        setChats(result.chats);
      }
    } catch (err: any) {
      console.error('Failed to load chats:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const status = await whatsappApi.getStatus();
        setWaConnected(status.status === 'READY');
      } catch {
        setWaConnected(false);
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

  const loadMessages = async (chat: ChatInfo) => {
    setIsLoadingMessages(true);
    try {
      const result = await chatApi.fetchMessages(chat.id, 50);
      if (result.success) {
        setMessages(result.messages);
        await chatApi.sendSeen(chat.id);
      }
    } catch (err: any) {
      console.error('Failed to load messages:', err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSelectChat = async (chat: ChatInfo) => {
    setSelectedChat(chat);
    setShowChatMenu(null);
    await loadMessages(chat);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      await chatApi.sendTyping(selectedChat.id);
      const result = await chatApi.sendMessage(selectedChat.id, newMessage.trim());
      if (result.success) {
        setNewMessage('');
        await loadMessages(selectedChat);
      }
    } catch (err: any) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
      await chatApi.clearState(selectedChat.id);
    }
  };

  const handleArchive = async (chat: ChatInfo) => {
    try {
      if (chat.archived) {
        await chatApi.unarchive(chat.id);
      } else {
        await chatApi.archive(chat.id);
      }
      await loadChats();
      setShowChatMenu(null);
    } catch (err) {
      console.error('Failed to archive chat:', err);
    }
  };

  const handlePin = async (chat: ChatInfo) => {
    try {
      if (chat.pinned) {
        await chatApi.unpin(chat.id);
      } else {
        await chatApi.pin(chat.id);
      }
      await loadChats();
      setShowChatMenu(null);
    } catch (err) {
      console.error('Failed to pin chat:', err);
    }
  };

  const handleMute = async (chat: ChatInfo) => {
    try {
      if (chat.isMuted) {
        await chatApi.unmute(chat.id);
      } else {
        await chatApi.mute(chat.id);
      }
      await loadChats();
      setShowChatMenu(null);
    } catch (err) {
      console.error('Failed to mute chat:', err);
    }
  };

  const handleDelete = async (chat: ChatInfo) => {
    if (!confirm(`Delete chat with ${chat.name}?`)) return;
    try {
      await chatApi.delete(chat.id);
      if (selectedChat?.id === chat.id) {
        setSelectedChat(null);
        setMessages([]);
      }
      await loadChats();
      setShowChatMenu(null);
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      inputRef.current?.focus();
    }
  }, [selectedChat]);

  const filteredChats = chats.filter(chat => {
    const matchesSearch = chat.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'unread') return matchesSearch && chat.unreadCount > 0;
    if (activeTab === 'groups') return matchesSearch && chat.isGroup;
    return matchesSearch;
  });

  const sortedChats = [...filteredChats].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return (b.timestamp || 0) - (a.timestamp || 0);
  });

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
      <div className="p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
              <MessageCircle size={32} className="text-yellow-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">WhatsApp Not Connected</h3>
            <p className="text-gray-500 text-center max-w-md">
              Please connect your WhatsApp device first to view and manage chats.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex overflow-hidden">
        {/* Chat List Panel */}
        <div className={`w-full md:w-96 border-r border-gray-200 flex flex-col ${selectedChat ? 'hidden md:flex' : 'flex'}`}>
          {/* Header */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">Chats</h2>
              <button 
                onClick={loadChats}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search chats..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mt-3">
              {(['all', 'unread', 'groups'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab 
                      ? 'bg-emerald-100 text-emerald-700' 
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {tab === 'all' ? 'All' : tab === 'unread' ? 'Unread' : 'Groups'}
                </button>
              ))}
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-emerald-600" />
              </div>
            ) : sortedChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <MessageCircle size={48} className="mb-2 opacity-50" />
                <p>No chats found</p>
              </div>
            ) : (
              sortedChats.map((chat) => (
                <div
                  key={chat.id}
                  className={`relative flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-emerald-50' : ''
                  }`}
                  onClick={() => handleSelectChat(chat)}
                >
                  {/* Avatar */}
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                    chat.isGroup ? 'bg-blue-100' : 'bg-emerald-100'
                  }`}>
                    {chat.isGroup ? (
                      <Users size={20} className="text-blue-600" />
                    ) : (
                      <User size={20} className="text-emerald-600" />
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        {chat.pinned && <Pin size={12} className="text-gray-400" />}
                        {chat.isMuted && <BellOff size={12} className="text-gray-400" />}
                        <span className="font-medium text-gray-800 truncate">{chat.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">{formatTime(chat.timestamp)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className="text-sm text-gray-500 truncate pr-2">
                        {chat.lastMessage?.body || 'No messages'}
                      </p>
                      {chat.unreadCount > 0 && (
                        <span className="bg-emerald-500 text-white text-xs px-2 py-0.5 rounded-full">
                          {chat.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Menu Button */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChatMenu(showChatMenu === chat.id ? null : chat.id);
                    }}
                    className="p-1 rounded-lg hover:bg-gray-200 text-gray-400"
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Dropdown Menu */}
                  {showChatMenu === chat.id && (
                    <div className="absolute right-4 top-12 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[140px]">
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePin(chat); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Pin size={14} />
                        {chat.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleArchive(chat); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Archive size={14} />
                        {chat.archived ? 'Unarchive' : 'Archive'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMute(chat); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                      >
                        {chat.isMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                        {chat.isMuted ? 'Unmute' : 'Mute'}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(chat); }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-red-500"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Panel */}
        <div className={`flex-1 flex flex-col ${selectedChat ? 'flex' : 'hidden md:flex'}`}>
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-200 flex items-center gap-3">
                <button 
                  onClick={() => setSelectedChat(null)}
                  className="md:hidden p-2 rounded-lg hover:bg-gray-100"
                >
                  <ArrowLeft size={20} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  selectedChat.isGroup ? 'bg-blue-100' : 'bg-emerald-100'
                }`}>
                  {selectedChat.isGroup ? (
                    <Users size={18} className="text-blue-600" />
                  ) : (
                    <User size={18} className="text-emerald-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800">{selectedChat.name}</h3>
                  <p className="text-xs text-gray-500">
                    {selectedChat.isGroup ? 'Group' : 'Private Chat'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={24} className="animate-spin text-emerald-600" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <MessageCircle size={48} className="mb-2" />
                    <p>No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[75%] px-4 py-2 rounded-2xl ${
                            msg.fromMe 
                              ? 'bg-emerald-500 text-white rounded-br-md' 
                              : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{msg.body || '[Media]'}</p>
                          <div className={`flex items-center gap-1 justify-end mt-1 ${
                            msg.fromMe ? 'text-emerald-100' : 'text-gray-400'
                          }`}>
                            <span className="text-xs">{formatTime(msg.timestamp)}</span>
                            {msg.fromMe && (
                              <CheckCheck size={14} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    disabled={isSending}
                  />
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || isSending}
                    className="p-3 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSending ? (
                      <Loader2 size={20} className="animate-spin" />
                    ) : (
                      <Send size={20} />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageCircle size={64} className="mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Select a chat</h3>
              <p className="text-sm">Choose a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatView;
