import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import { EventEmitter } from 'events';
import { ConnectionStatus, Contact, MessageType } from '../types.js';
import * as QRCode from 'qrcode';

class WhatsAppClientService extends EventEmitter {
  private client: InstanceType<typeof Client> | null = null;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private qrCodeData: string | null = null;
  private clientInfo: any = null;

  constructor() {
    super();
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  getQRCode(): string | null {
    return this.qrCodeData;
  }

  getClientInfo(): any {
    return this.clientInfo;
  }

  async initialize(): Promise<void> {
    if (this.client) {
      console.log('Client already exists, destroying...');
      await this.destroy();
    }

    this.setStatus(ConnectionStatus.CONNECTING);

    this.client = new Client({
      authStrategy: new LocalAuth({
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

    this.setupEventListeners();

    try {
      await this.client.initialize();
    } catch (error) {
      console.error('Failed to initialize WhatsApp client:', error);
      this.setStatus(ConnectionStatus.DISCONNECTED);
      throw error;
    }
  }

  private setupEventListeners(): void {
    if (!this.client) return;

    this.client.on('qr', async (qr: string) => {
      console.log('QR Code received');
      try {
        this.qrCodeData = await QRCode.toDataURL(qr);
        this.setStatus(ConnectionStatus.QR_READY);
        this.emit('qr', this.qrCodeData);
      } catch (err) {
        console.error('Error generating QR code:', err);
      }
    });

    this.client.on('authenticated', () => {
      console.log('WhatsApp authenticated');
      this.qrCodeData = null;
      this.setStatus(ConnectionStatus.AUTHENTICATED);
      this.emit('authenticated');
    });

    this.client.on('auth_failure', (msg: string) => {
      console.error('Authentication failure:', msg);
      this.setStatus(ConnectionStatus.AUTH_FAILURE);
      this.emit('auth_failure', msg);
    });

    this.client.on('ready', () => {
      console.log('WhatsApp client is ready');
      this.clientInfo = this.client?.info;
      this.setStatus(ConnectionStatus.READY);
      this.emit('ready', this.clientInfo);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log('WhatsApp disconnected:', reason);
      this.clientInfo = null;
      this.setStatus(ConnectionStatus.DISCONNECTED);
      this.emit('disconnected', reason);
    });

    this.client.on('message', (message: any) => {
      this.emit('message', message);
    });
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    this.emit('status_change', status);
  }

  async sendTextMessage(phone: string, content: string): Promise<any> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const result = await this.client.sendMessage(chatId, content);
    return result;
  }

  async sendMediaMessage(
    phone: string,
    mediaPath: string,
    caption?: string,
    type: MessageType = MessageType.IMAGE
  ): Promise<any> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
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

    const result = await this.client.sendMessage(chatId, media, options);
    return result;
  }

  async sendMediaFromUrl(
    phone: string,
    url: string,
    caption?: string,
    type: MessageType = MessageType.IMAGE
  ): Promise<any> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
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

    const result = await this.client.sendMessage(chatId, media, options);
    return result;
  }

  async getContacts(): Promise<Contact[]> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      // Try the standard getContacts method first
      const contacts = await this.client.getContacts();
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
      console.log('getContacts failed, falling back to getChats method');
      // Fallback: Extract contacts from chats
      return await this.getContactsFromChats();
    }
  }

  async getContactsFromChats(): Promise<Contact[]> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.client.getChats();
    const contactsMap = new Map<string, Contact>();

    for (const chat of chats) {
      try {
        const chatId = (chat as any).id._serialized;
        const isGroup = (chat as any).isGroup;
        
        if (!isGroup) {
          // Individual chat - extract contact info directly from chat
          const phone = chatId.replace('@c.us', '');
          
          // Try multiple sources for the contact name
          const chatData = (chat as any)._data || {};
          const contactName = 
            chatData.name ||
            chatData.pushname ||
            chatData.notifyName ||
            chatData.verifiedName ||
            chatData.formattedTitle ||
            (chat as any).name ||
            (chat as any).formattedTitle ||
            '';
          
          // Don't use phone number as name
          const displayName = (contactName && contactName !== phone && !contactName.startsWith('+')) 
            ? contactName 
            : '';
          
          if (!contactsMap.has(chatId)) {
            contactsMap.set(chatId, {
              id: chatId,
              name: displayName || phone || 'Unknown',
              phone: phone,
              pushname: chatData.pushname || chatData.notifyName || '',
              isGroup: false
            });
          }
        } else {
          // Group chat
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
        // Skip contacts that fail to load
        console.error('Error loading contact from chat:', err);
      }
    }

    return Array.from(contactsMap.values());
  }

  async getChats(): Promise<any[]> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    return await this.client.getChats();
  }

  async checkNumberRegistered(phone: string): Promise<boolean> {
    if (!this.client || this.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chatId = this.formatPhoneNumber(phone);
    const result = await this.client.isRegisteredUser(chatId);
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

  async logout(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch (error) {
        console.error('Error during logout:', error);
      }
    }
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.clientInfo = null;
    this.qrCodeData = null;
  }

  async destroy(): Promise<void> {
    if (this.client) {
      try {
        await this.client.destroy();
      } catch (error) {
        console.error('Error destroying client:', error);
      }
      this.client = null;
    }
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.clientInfo = null;
    this.qrCodeData = null;
  }

  isReady(): boolean {
    return this.status === ConnectionStatus.READY;
  }
}

export const whatsappClient = new WhatsAppClientService();
