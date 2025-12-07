const API_BASE = 'http://localhost:3001/api';

export interface ApiResponse<T = any> {
  success: boolean;
  error?: string;
  data?: T;
}

function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}

async function request<T>(
  endpoint: string, 
  options: RequestInit = {},
  includeAuth: boolean = true
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers as Record<string, string>,
  };

  if (includeAuth) {
    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }
  
  return data;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export const authApi = {
  register: (name: string, email: string, password: string) =>
    request<{
      success: boolean;
      message: string;
      user: AuthUser;
      token: string;
    }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    }, false),

  login: (email: string, password: string, rememberMe: boolean = false) =>
    request<{
      success: boolean;
      message: string;
      user: AuthUser;
      token: string;
      rememberToken?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, rememberMe }),
    }, false),

  loginWithRememberToken: (rememberToken: string) =>
    request<{
      success: boolean;
      message: string;
      user: AuthUser;
      token: string;
      rememberToken?: string;
    }>('/auth/login-remember', {
      method: 'POST',
      body: JSON.stringify({ rememberToken }),
    }, false),

  logout: () =>
    request<{ success: boolean; message: string }>('/auth/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{
      success: boolean;
      message: string;
      resetToken?: string;
    }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }, false),

  resetPassword: (token: string, newPassword: string) =>
    request<{
      success: boolean;
      message: string;
      user: AuthUser;
      token: string;
    }>('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }, false),

  getMe: () =>
    request<{ success: boolean; user: AuthUser }>('/auth/me'),

  updateProfile: (data: { name: string }) =>
    request<{ success: boolean; message?: string; error?: string; user?: AuthUser }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message?: string; error?: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

export const settingsApi = {
  getAll: () =>
    request<{ success: boolean; settings: Record<string, string> }>('/settings'),

  get: (key: string) =>
    request<{ success: boolean; value: string | null }>(`/settings/${key}`),

  save: (key: string, value: string) =>
    request<{ success: boolean; message?: string }>('/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value }),
    }),

  saveBulk: (settings: Record<string, string>) =>
    request<{ success: boolean; message?: string }>('/settings/bulk', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    }),

  delete: (key: string) =>
    request<{ success: boolean; message?: string }>(`/settings/${key}`, {
      method: 'DELETE',
    }),
};

export const whatsappApi = {
  getStatus: () => request<{
    status: string;
    qrCode: string | null;
    pairingCode: string | null;
    clientInfo: any;
  }>('/whatsapp/status'),
  
  connect: () => request<{
    success: boolean;
    message: string;
    status: string;
  }>('/whatsapp/connect', { method: 'POST' }),

  connectWithPairing: (phoneNumber: string) => request<{
    success: boolean;
    message: string;
    pairingCode: string;
    status: string;
  }>('/whatsapp/connect-pairing', { 
    method: 'POST',
    body: JSON.stringify({ phoneNumber })
  }),
  
  disconnect: () => request<{
    success: boolean;
    message: string;
  }>('/whatsapp/disconnect', { method: 'POST' }),
  
  sendMessage: (phone: string, type: string, content: string, mediaUrl?: string) => 
    request<{
      success: boolean;
      messageId: string;
    }>('/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify({ phone, type, content, mediaUrl }),
    }),
    
  checkNumber: (phone: string) => 
    request<{
      phone: string;
      isRegistered: boolean;
    }>(`/whatsapp/check-number/${phone}`),

  sendPoll: (phone: string, question: string, options: string[], allowMultiple?: boolean) =>
    request<{
      success: boolean;
      messageId: string;
    }>('/whatsapp/send-poll', {
      method: 'POST',
      body: JSON.stringify({ phone, question, options, allowMultiple }),
    }),

  sendLocation: (phone: string, latitude: number, longitude: number, description?: string) =>
    request<{
      success: boolean;
      messageId: string;
    }>('/whatsapp/send-location', {
      method: 'POST',
      body: JSON.stringify({ phone, latitude, longitude, description }),
    }),

  getWhatsAppGroups: () =>
    request<{
      success: boolean;
      groups: Array<{
        id: string;
        name: string;
        participantsCount: number;
        isAdmin: boolean;
      }>;
    }>('/whatsapp/groups'),

  getGroupParticipants: (groupId: string) =>
    request<{
      success: boolean;
      participants: string[];
    }>(`/whatsapp/groups/${encodeURIComponent(groupId)}/participants`),

  sendToGroup: (groupId: string, type: string, content: string, mediaUrl?: string, pollData?: any) =>
    request<{
      success: boolean;
      messageId: string;
    }>('/whatsapp/send-to-group', {
      method: 'POST',
      body: JSON.stringify({ groupId, type, content, mediaUrl, pollData }),
    }),
};

export interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
}

export interface WhatsAppContact {
  id: string;
  number: string;
  name: string | null;
  pushname: string;
  shortName: string | null;
  isBlocked: boolean;
  isBusiness: boolean;
  isEnterprise: boolean;
  isGroup: boolean;
  isMe: boolean;
  isMyContact: boolean;
  isUser: boolean;
  isWAContact: boolean;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  contactIds: string[];
}

export interface PaginatedResponse<T> {
  success: boolean;
  contacts: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const contactsApi = {
  // Get all contacts from database
  getAll: () => request<{
    success: boolean;
    count: number;
    contacts: Contact[];
  }>('/contacts'),

  // Get contacts with pagination
  getPaginated: (page: number = 1, limit: number = 20, search: string = '') =>
    request<PaginatedResponse<Contact>>(
      `/contacts?paginated=true&page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    ),

  // Get contacts from WhatsApp (for syncing) - detailed info
  getFromWhatsApp: () => request<{
    success: boolean;
    count: number;
    contacts: Array<WhatsAppContact>;
  }>('/contacts/whatsapp'),

  // Get single WhatsApp contact by ID
  getWhatsAppContact: (contactId: string) => request<{
    success: boolean;
    contact: WhatsAppContact;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}`),

  // Get contact profile picture URL
  getContactProfilePic: (contactId: string) => request<{
    success: boolean;
    profilePicUrl: string | null;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/profile-pic`),

  // Get contact about/status
  getContactAbout: (contactId: string) => request<{
    success: boolean;
    about: string | null;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/about`),

  // Get contact formatted number
  getContactFormattedNumber: (contactId: string) => request<{
    success: boolean;
    formattedNumber: string;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/formatted-number`),

  // Get contact country code
  getContactCountryCode: (contactId: string) => request<{
    success: boolean;
    countryCode: string;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/country-code`),

  // Get common groups with contact
  getContactCommonGroups: (contactId: string) => request<{
    success: boolean;
    count: number;
    groups: string[];
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/common-groups`),

  // Block contact
  blockContact: (contactId: string) => request<{
    success: boolean;
    blocked: boolean;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/block`, { method: 'POST' }),

  // Unblock contact
  unblockContact: (contactId: string) => request<{
    success: boolean;
    unblocked: boolean;
  }>(`/contacts/whatsapp/${encodeURIComponent(contactId)}/unblock`, { method: 'POST' }),

  // Get blocked contacts
  getBlockedContacts: () => request<{
    success: boolean;
    count: number;
    contacts: Array<{ id: string; number: string; name: string; pushname: string }>;
  }>('/contacts/whatsapp-blocked'),

  // Create contact
  create: (contact: { name: string; phone: string; tags?: string[] }) =>
    request<{ success: boolean; contact: Contact }>('/contacts', {
      method: 'POST',
      body: JSON.stringify(contact),
    }),

  // Import multiple contacts
  importMany: (contacts: Array<{ name: string; phone: string; tags?: string[] }>) =>
    request<{ success: boolean; imported: number }>('/contacts/import', {
      method: 'POST',
      body: JSON.stringify({ contacts }),
    }),

  // Update contact
  update: (id: string, contact: Partial<Contact>) =>
    request<{ success: boolean; message: string }>(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(contact),
    }),

  // Delete contact
  delete: (id: string) =>
    request<{ success: boolean; message: string }>(`/contacts/${id}`, {
      method: 'DELETE',
    }),

  // Delete multiple contacts
  deleteMany: (ids: string[]) =>
    request<{ success: boolean; deleted: number }>('/contacts/delete-many', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  // Get all groups
  getGroups: () => request<{
    success: boolean;
    count: number;
    groups: Group[];
  }>('/contacts/groups'),

  // Create group
  createGroup: (group: { name: string; description?: string; contactIds?: string[] }) =>
    request<{ success: boolean; group: Group }>('/contacts/groups', {
      method: 'POST',
      body: JSON.stringify(group),
    }),

  // Update group
  updateGroup: (id: string, group: { name?: string; description?: string }) =>
    request<{ success: boolean; message: string }>(`/contacts/groups/${id}`, {
      method: 'PUT',
      body: JSON.stringify(group),
    }),

  // Delete group
  deleteGroup: (id: string) =>
    request<{ success: boolean; message: string }>(`/contacts/groups/${id}`, {
      method: 'DELETE',
    }),

  // Add contacts to group
  addContactsToGroup: (groupId: string, contactIds: string[]) =>
    request<{ success: boolean; added: number }>(`/contacts/groups/${groupId}/contacts`, {
      method: 'POST',
      body: JSON.stringify({ contactIds }),
    }),

  // Get chats from WhatsApp
  getChats: () => request<{
    success: boolean;
    count: number;
    chats: Array<{
      id: string;
      name: string;
      isGroup: boolean;
      unreadCount: number;
      timestamp: number;
      lastMessage?: string;
    }>;
  }>('/contacts/chats'),
  
  // Validate phone numbers
  validateNumbers: (phones: string[]) => 
    request<{
      success: boolean;
      total: number;
      validCount: number;
      invalidCount: number;
      results: Array<{
        phone: string;
        isRegistered: boolean;
        error: string | null;
      }>;
    }>('/contacts/validate', {
      method: 'POST',
      body: JSON.stringify({ phones }),
    }),
};

export interface DashboardStats {
  totalSent: number;
  delivered: number;
  pending: number;
  failed: number;
}

export interface BlastJob {
  id: string;
  message_type: string;
  content: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export const blastApi = {
  create: async (formData: FormData) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}/blast/create`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return response.json();
  },
  
  start: (jobId: string) => 
    request<{ success: boolean; message: string }>(`/blast/${jobId}/start`, { method: 'POST' }),
  
  pause: (jobId: string) => 
    request<{ success: boolean; message: string }>(`/blast/${jobId}/pause`, { method: 'POST' }),
  
  resume: (jobId: string) => 
    request<{ success: boolean; message: string }>(`/blast/${jobId}/resume`, { method: 'POST' }),
  
  cancel: (jobId: string) => 
    request<{ success: boolean; message: string }>(`/blast/${jobId}/cancel`, { method: 'POST' }),
  
  getJob: (jobId: string) => 
    request<{
      success: boolean;
      job: any;
    }>(`/blast/${jobId}`),
  
  getAllJobs: () => 
    request<{
      success: boolean;
      count: number;
      jobs: any[];
    }>('/blast'),
  
  // Get blast history from database
  getHistory: (limit: number = 50) =>
    request<{
      success: boolean;
      count: number;
      jobs: BlastJob[];
    }>(`/blast/history?limit=${limit}`),

  // Get dashboard stats
  getDashboardStats: () =>
    request<{
      success: boolean;
      stats: DashboardStats;
    }>('/blast/stats/dashboard'),
  
  deleteJob: (jobId: string) => 
    request<{ success: boolean; message: string }>(`/blast/${jobId}`, { method: 'DELETE' }),

  // Scheduled blast APIs
  getScheduled: () =>
    request<{
      success: boolean;
      count: number;
      jobs: BlastJob[];
    }>('/blast/scheduled'),

  createScheduled: async (formData: FormData) => {
    const token = getAuthToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE}/blast/schedule`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return response.json();
  },

  cancelScheduled: (jobId: string) =>
    request<{ success: boolean; message: string }>(`/blast/${jobId}/cancel-schedule`, { method: 'POST' }),
};

export const healthApi = {
  check: () => request<{
    status: string;
    whatsapp: string;
    timestamp: string;
  }>('/health'),
};

// ==================== CHAT API ====================

export interface ChatInfo {
  id: string;
  name: string;
  isGroup: boolean;
  isReadOnly: boolean;
  unreadCount: number;
  timestamp: number;
  archived: boolean;
  pinned: boolean;
  isMuted: boolean;
  muteExpiration: number;
  lastMessage?: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  };
}

export interface ChatMessage {
  id: string;
  body: string;
  type: string;
  timestamp: number;
  fromMe: boolean;
  from: string;
  to: string;
  hasMedia: boolean;
  isForwarded: boolean;
  isStarred: boolean;
}

export interface ChatContact {
  id: string;
  name: string;
  number: string;
  pushname: string;
  isGroup: boolean;
  isWAContact: boolean;
}

export const chatApi = {
  getAll: () =>
    request<{ success: boolean; count: number; chats: ChatInfo[] }>('/chat'),

  getById: (chatId: string) =>
    request<{ success: boolean; chat: ChatInfo }>(`/chat/${encodeURIComponent(chatId)}`),

  fetchMessages: (chatId: string, limit: number = 50, fromMe?: boolean) => {
    let url = `/chat/${encodeURIComponent(chatId)}/messages?limit=${limit}`;
    if (fromMe !== undefined) url += `&fromMe=${fromMe}`;
    return request<{ success: boolean; count: number; messages: ChatMessage[] }>(url);
  },

  sendMessage: (chatId: string, content: string, options?: any) =>
    request<{ success: boolean; messageId: string; timestamp: number }>(`/chat/${encodeURIComponent(chatId)}/send`, {
      method: 'POST',
      body: JSON.stringify({ content, options }),
    }),

  sendSeen: (chatId: string) =>
    request<{ success: boolean; result: boolean }>(`/chat/${encodeURIComponent(chatId)}/seen`, { method: 'POST' }),

  archive: (chatId: string) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/archive`, { method: 'POST' }),

  unarchive: (chatId: string) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/unarchive`, { method: 'POST' }),

  pin: (chatId: string) =>
    request<{ success: boolean; pinned: boolean }>(`/chat/${encodeURIComponent(chatId)}/pin`, { method: 'POST' }),

  unpin: (chatId: string) =>
    request<{ success: boolean; pinned: boolean }>(`/chat/${encodeURIComponent(chatId)}/unpin`, { method: 'POST' }),

  mute: (chatId: string, unmuteDate?: string) =>
    request<{ success: boolean; isMuted: boolean; muteExpiration: number }>(`/chat/${encodeURIComponent(chatId)}/mute`, {
      method: 'POST',
      body: JSON.stringify({ unmuteDate }),
    }),

  unmute: (chatId: string) =>
    request<{ success: boolean; isMuted: boolean; muteExpiration: number }>(`/chat/${encodeURIComponent(chatId)}/unmute`, { method: 'POST' }),

  markUnread: (chatId: string) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/mark-unread`, { method: 'POST' }),

  clearMessages: (chatId: string) =>
    request<{ success: boolean; result: boolean }>(`/chat/${encodeURIComponent(chatId)}/clear`, { method: 'POST' }),

  delete: (chatId: string) =>
    request<{ success: boolean; result: boolean }>(`/chat/${encodeURIComponent(chatId)}`, { method: 'DELETE' }),

  getContact: (chatId: string) =>
    request<{ success: boolean; contact: ChatContact }>(`/chat/${encodeURIComponent(chatId)}/contact`),

  sendTyping: (chatId: string) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/typing`, { method: 'POST' }),

  sendRecording: (chatId: string) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/recording`, { method: 'POST' }),

  clearState: (chatId: string) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/clear-state`, { method: 'POST' }),

  getPinnedMessages: (chatId: string) =>
    request<{ success: boolean; messages: ChatMessage[] }>(`/chat/${encodeURIComponent(chatId)}/pinned-messages`),

  getLabels: (chatId: string) =>
    request<{ success: boolean; labels: any[] }>(`/chat/${encodeURIComponent(chatId)}/labels`),

  changeLabels: (chatId: string, labelIds: (string | number)[]) =>
    request<{ success: boolean }>(`/chat/${encodeURIComponent(chatId)}/labels`, {
      method: 'POST',
      body: JSON.stringify({ labelIds }),
    }),
};

// ==================== HEADER FEATURES API ====================

export interface SearchResult {
  contacts: Array<{ id: string; name: string; phone: string; tags: string[] }>;
  history: Array<{ id: string; content: string; message_type: string; status: string; total_recipients: number; created_at: string }>;
  templates: Array<{ id: string; name: string; content: string; message_type: string }>;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

export interface InboxMessage {
  id: string;
  from_phone: string;
  from_name: string;
  message_type: string;
  content: string;
  media_url?: string;
  is_read: boolean;
  received_at: string;
}

export const headerApi = {
  // Search
  search: (query: string, category?: 'contacts' | 'history' | 'templates') =>
    request<{ success: boolean; results: SearchResult }>(
      `/header/search?q=${encodeURIComponent(query)}${category ? `&category=${category}` : ''}`
    ),

  // Notifications
  getNotifications: (limit: number = 20) =>
    request<{ success: boolean; notifications: Notification[]; unreadCount: number }>(
      `/header/notifications?limit=${limit}`
    ),

  markNotificationRead: (id: string) =>
    request<{ success: boolean }>(`/header/notifications/${id}/read`, { method: 'PUT' }),

  markAllNotificationsRead: () =>
    request<{ success: boolean }>('/header/notifications/read-all', { method: 'PUT' }),

  deleteNotification: (id: string) =>
    request<{ success: boolean }>(`/header/notifications/${id}`, { method: 'DELETE' }),

  clearAllNotifications: () =>
    request<{ success: boolean }>('/header/notifications', { method: 'DELETE' }),

  // Inbox
  getInbox: (limit: number = 20) =>
    request<{ success: boolean; messages: InboxMessage[]; unreadCount: number }>(
      `/header/inbox?limit=${limit}`
    ),

  markInboxRead: (id: string) =>
    request<{ success: boolean }>(`/header/inbox/${id}/read`, { method: 'PUT' }),

  markAllInboxRead: () =>
    request<{ success: boolean }>('/header/inbox/read-all', { method: 'PUT' }),

  deleteInboxMessage: (id: string) =>
    request<{ success: boolean }>(`/header/inbox/${id}`, { method: 'DELETE' }),
};
