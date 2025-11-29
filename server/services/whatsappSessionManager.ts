import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia, Poll, Location } = pkg;
import { EventEmitter } from 'events';
import { ConnectionStatus, Contact, MessageType, WhatsAppGroup, PollData, LocationData } from '../types.js';
import * as QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

interface UserSession {
  client: InstanceType<typeof Client> | null;
  status: ConnectionStatus;
  qrCodeData: string | null;
  pairingCode: string | null;
  clientInfo: any;
  userId: string;
  connectionMethod: 'qr' | 'pairing';
  pendingPhoneNumber: string | null;
  pairingCodeRequested: boolean;
}

class WhatsAppSessionManager extends EventEmitter {
  private sessions: Map<string, UserSession> = new Map();

  constructor() {
    super();
  }

  private getSession(userId: string): UserSession {
    let session = this.sessions.get(userId);
    if (!session) {
      session = {
        client: null,
        status: ConnectionStatus.DISCONNECTED,
        qrCodeData: null,
        pairingCode: null,
        clientInfo: null,
        userId,
        connectionMethod: 'qr',
        pendingPhoneNumber: null,
        pairingCodeRequested: false
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  getStatus(userId: string): ConnectionStatus {
    return this.getSession(userId).status;
  }

  getQRCode(userId: string): string | null {
    return this.getSession(userId).qrCodeData;
  }

  getClientInfo(userId: string): any {
    return this.getSession(userId).clientInfo;
  }

  getPairingCode(userId: string): string | null {
    return this.getSession(userId).pairingCode;
  }

  async initialize(userId: string, method: 'qr' | 'pairing' = 'qr', phoneNumber?: string): Promise<string | null> {
    const session = this.getSession(userId);

    if (session.client) {
      console.log(`[${userId}] Client already exists, destroying...`);
      await this.destroy(userId);
    }

    this.setStatus(userId, ConnectionStatus.CONNECTING);
    session.connectionMethod = method;
    session.pairingCode = null;
    session.pendingPhoneNumber = phoneNumber || null;
    session.pairingCodeRequested = false;

    const sessionPath = path.join('./wa-session', userId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    session.client = new Client({
      authStrategy: new LocalAuth({
        clientId: userId,
        dataPath: './wa-session'
      }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    this.setupEventListeners(userId);

    // For pairing method, we need to wait and return a promise that resolves with the code
    if (method === 'pairing' && phoneNumber) {
      console.log(`[${userId}] Starting pairing mode for ${phoneNumber}`);
      
      return new Promise<string>((resolve, reject) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            console.error(`[${userId}] Timeout waiting for pairing code`);
            reject(new Error('Timeout waiting for pairing code. Make sure WhatsApp is not already linked.'));
          }
        }, 90000); // 90 second timeout

        const checkPairingCode = () => {
          if (resolved) return;
          
          if (session.pairingCode) {
            resolved = true;
            clearTimeout(timeout);
            console.log(`[${userId}] Pairing code ready: ${session.pairingCode}`);
            resolve(session.pairingCode);
          } else if (session.status === ConnectionStatus.DISCONNECTED) {
            resolved = true;
            clearTimeout(timeout);
            reject(new Error('Connection failed'));
          } else if (session.status === ConnectionStatus.READY) {
            // Already connected
            resolved = true;
            clearTimeout(timeout);
            reject(new Error('Device already connected'));
          } else {
            setTimeout(checkPairingCode, 500);
          }
        };

        // Start initialization
        console.log(`[${userId}] Initializing client for pairing...`);
        session.client!.initialize().then(() => {
          console.log(`[${userId}] Client initialized successfully`);
        }).catch((error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            console.error(`[${userId}] Failed to initialize WhatsApp client:`, error);
            this.setStatus(userId, ConnectionStatus.DISCONNECTED);
            reject(error);
          }
        });

        // Start checking for pairing code after a short delay
        setTimeout(checkPairingCode, 2000);
      });
    }

    try {
      await session.client.initialize();
      return null;
    } catch (error) {
      console.error(`[${userId}] Failed to initialize WhatsApp client:`, error);
      this.setStatus(userId, ConnectionStatus.DISCONNECTED);
      throw error;
    }
  }

  async requestPairingCode(userId: string, phoneNumber: string): Promise<string> {
    const session = this.getSession(userId);
    if (!session.client) {
      console.error(`[${userId}] Cannot request pairing code - client not initialized`);
      throw new Error('WhatsApp client is not initialized');
    }

    // Clean phone number - remove + and any non-digits
    let cleanedNumber = phoneNumber.replace(/\D/g, '');
    
    // Remove leading 0 and add country code if needed
    if (cleanedNumber.startsWith('0')) {
      cleanedNumber = '62' + cleanedNumber.substring(1);
    }

    console.log(`[${userId}] Requesting pairing code for ${cleanedNumber}`);

    try {
      // Check if requestPairingCode method exists
      if (typeof session.client.requestPairingCode !== 'function') {
        throw new Error('Pairing code not supported. Please update whatsapp-web.js library.');
      }

      const code = await session.client.requestPairingCode(cleanedNumber);
      session.pairingCode = code;
      
      // Emit event for pairing code
      this.emit('pairing_code', userId, code);
      
      console.log(`[${userId}] Pairing code received: ${code}`);
      return code;
    } catch (error: any) {
      console.error(`[${userId}] Failed to request pairing code:`, error.message || error);
      session.pairingCode = null;
      throw new Error(error.message || 'Failed to request pairing code');
    }
  }

  private setupEventListeners(userId: string): void {
    const session = this.getSession(userId);
    if (!session.client) return;

    // Listen for pairing code event
    session.client.on('code', (code: string) => {
      console.log(`[${userId}] Pairing code received via event: ${code}`);
      session.pairingCode = code;
      this.emit('pairing_code', userId, code);
    });

    session.client.on('qr', async (qr: string) => {
      console.log(`[${userId}] QR Code received`);
      
      // If pairing mode and we have a pending phone number, request pairing code
      if (session.connectionMethod === 'pairing' && session.pendingPhoneNumber && !session.pairingCodeRequested) {
        session.pairingCodeRequested = true;
        console.log(`[${userId}] Pairing mode - requesting pairing code for ${session.pendingPhoneNumber}...`);
        try {
          await this.requestPairingCode(userId, session.pendingPhoneNumber);
        } catch (err: any) {
          console.error(`[${userId}] Error requesting pairing code:`, err.message || err);
        }
        return; // Don't show QR code in pairing mode
      }
      
      try {
        session.qrCodeData = await QRCode.toDataURL(qr);
        this.setStatus(userId, ConnectionStatus.QR_READY);
        this.emit('qr', userId, session.qrCodeData);
      } catch (err) {
        console.error(`[${userId}] Error generating QR code:`, err);
      }
    });

    session.client.on('authenticated', () => {
      console.log(`[${userId}] WhatsApp authenticated`);
      session.qrCodeData = null;
      this.setStatus(userId, ConnectionStatus.AUTHENTICATED);
      this.emit('authenticated', userId);
    });

    session.client.on('auth_failure', (msg: string) => {
      console.error(`[${userId}] Authentication failure:`, msg);
      this.setStatus(userId, ConnectionStatus.AUTH_FAILURE);
      this.emit('auth_failure', userId, msg);
    });

    session.client.on('ready', () => {
      console.log(`[${userId}] WhatsApp client is ready`);
      session.clientInfo = session.client?.info;
      this.setStatus(userId, ConnectionStatus.READY);
      this.emit('ready', userId, session.clientInfo);
    });

    session.client.on('disconnected', (reason: string) => {
      console.log(`[${userId}] WhatsApp disconnected:`, reason);
      session.clientInfo = null;
      this.setStatus(userId, ConnectionStatus.DISCONNECTED);
      this.emit('disconnected', userId, reason);
    });

    session.client.on('message', (message: any) => {
      this.emit('message', userId, message);
    });
  }

  private setStatus(userId: string, status: ConnectionStatus): void {
    const session = this.getSession(userId);
    session.status = status;
    this.emit('status_change', userId, status);
  }

  async sendTextMessage(userId: string, phone: string, content: string): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const result = await session.client.sendMessage(chatId, content);
    return result;
  }

  async sendMediaMessage(
    userId: string,
    phone: string,
    mediaPath: string,
    caption?: string,
    type: MessageType = MessageType.IMAGE
  ): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const media = MessageMedia.fromFilePath(mediaPath);
    
    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    if (type === MessageType.DOCUMENT) {
      options.sendMediaAsDocument = true;
    }

    const result = await session.client.sendMessage(chatId, media, options);
    return result;
  }

  async sendMediaFromUrl(
    userId: string,
    phone: string,
    url: string,
    caption?: string,
    type: MessageType = MessageType.IMAGE
  ): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const media = await MessageMedia.fromUrl(url);
    
    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    if (type === MessageType.DOCUMENT) {
      options.sendMediaAsDocument = true;
    }

    const result = await session.client.sendMessage(chatId, media, options);
    return result;
  }

  async getContacts(userId: string): Promise<Contact[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contacts = await session.client.getContacts();
      return contacts
        .filter((c: any) => c.id.server === 'c.us' || c.id.server === 'g.us')
        .map((c: any) => ({
          id: c.id._serialized,
          name: c.name || c.pushname || c.number || 'Unknown',
          phone: c.number || '',
          pushname: c.pushname,
          isGroup: c.id.server === 'g.us'
        }));
    } catch (error) {
      console.log(`[${userId}] getContacts failed, falling back to getChats method`);
      return await this.getContactsFromChats(userId);
    }
  }

  async getContactsFromChats(userId: string): Promise<Contact[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await session.client.getChats();
    const contactsMap = new Map<string, Contact>();

    for (const chat of chats) {
      try {
        const chatId = (chat as any).id._serialized;
        const isGroup = (chat as any).isGroup;
        
        if (!isGroup) {
          const contact = await chat.getContact();
          const phone = (contact as any).number || chatId.replace('@c.us', '');
          
          if (!contactsMap.has(chatId)) {
            contactsMap.set(chatId, {
              id: chatId,
              name: (contact as any).name || (contact as any).pushname || phone || 'Unknown',
              phone: phone,
              pushname: (contact as any).pushname,
              isGroup: false
            });
          }
        } else {
          if (!contactsMap.has(chatId)) {
            contactsMap.set(chatId, {
              id: chatId,
              name: (chat as any).name || 'Unknown Group',
              phone: '',
              pushname: undefined,
              isGroup: true
            });
          }
        }
      } catch (err) {
        console.error(`[${userId}] Error loading contact from chat:`, err);
      }
    }

    return Array.from(contactsMap.values());
  }

  async getChats(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    return await session.client.getChats();
  }

  async checkNumberRegistered(userId: string, phone: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const result = await session.client.isRegisteredUser(chatId);
    return result;
  }

  private formatPhoneNumber(phone: string): string {
    let cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('0')) {
      cleaned = '62' + cleaned.substring(1);
    }
    
    if (!cleaned.includes('@')) {
      cleaned = cleaned + '@c.us';
    }
    
    return cleaned;
  }

  async logout(userId: string): Promise<void> {
    const session = this.getSession(userId);
    if (session.client) {
      try {
        await session.client.logout();
      } catch (error) {
        console.error(`[${userId}] Error during logout:`, error);
      }
    }
    this.setStatus(userId, ConnectionStatus.DISCONNECTED);
    session.clientInfo = null;
    session.qrCodeData = null;
  }

  async destroy(userId: string): Promise<void> {
    const session = this.getSession(userId);
    if (session.client) {
      try {
        await session.client.destroy();
      } catch (error) {
        console.error(`[${userId}] Error destroying client:`, error);
      }
      session.client = null;
    }
    this.setStatus(userId, ConnectionStatus.DISCONNECTED);
    session.clientInfo = null;
    session.qrCodeData = null;
  }

  // Send Poll
  async sendPoll(userId: string, phone: string, pollData: PollData): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const poll = new Poll(pollData.question, pollData.options);
    
    const result = await session.client.sendMessage(chatId, poll);
    return result;
  }

  // Send Location
  async sendLocation(userId: string, phone: string, locationData: LocationData): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const location = new Location(locationData.latitude, locationData.longitude, {
      name: locationData.description || ''
    });
    
    const result = await session.client.sendMessage(chatId, location);
    return result;
  }

  // Send to Group
  async sendToGroup(userId: string, groupId: string, content: string): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const result = await session.client.sendMessage(groupId, content);
    return result;
  }

  // Send Media to Group
  async sendMediaToGroup(userId: string, groupId: string, mediaPath: string, caption?: string): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const media = MessageMedia.fromFilePath(mediaPath);
    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    
    const result = await session.client.sendMessage(groupId, media, options);
    return result;
  }

  // Send Poll to Group
  async sendPollToGroup(userId: string, groupId: string, pollData: PollData): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const poll = new Poll(pollData.question, pollData.options);
    
    const result = await session.client.sendMessage(groupId, poll);
    return result;
  }

  // Get WhatsApp Groups
  async getWhatsAppGroups(userId: string): Promise<WhatsAppGroup[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await session.client.getChats();
    const groups: WhatsAppGroup[] = [];

    for (const chat of chats) {
      if ((chat as any).isGroup) {
        try {
          const groupChat = chat as any;
          groups.push({
            id: groupChat.id._serialized,
            name: groupChat.name || 'Unknown Group',
            participantsCount: groupChat.participants?.length || 0,
            isAdmin: groupChat.participants?.some((p: any) => 
              p.id._serialized === session.clientInfo?.wid?._serialized && p.isAdmin
            ) || false
          });
        } catch (err) {
          console.error(`[${userId}] Error getting group info:`, err);
        }
      }
    }

    return groups;
  }

  // Get Group Participants
  async getGroupParticipants(userId: string, groupId: string): Promise<string[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(groupId);
    if (!(chat as any).isGroup) {
      throw new Error('Chat is not a group');
    }

    const participants = (chat as any).participants || [];
    return participants.map((p: any) => p.id._serialized.replace('@c.us', ''));
  }

  isReady(userId: string): boolean {
    return this.getSession(userId).status === ConnectionStatus.READY;
  }

  hasActiveSession(userId: string): boolean {
    const session = this.sessions.get(userId);
    return session?.client !== null && session?.status !== ConnectionStatus.DISCONNECTED;
  }
}

export const whatsappSessionManager = new WhatsAppSessionManager();
