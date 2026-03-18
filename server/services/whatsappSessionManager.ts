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
  isChatStoreReady: boolean;
}

interface SafeClientInfo {
  wid?: {
    user?: string;
    _serialized?: string;
  };
  pushname?: string;
  platform?: string;
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
        pairingCodeRequested: false,
        isChatStoreReady: false
      };
      this.sessions.set(userId, session);
    }
    return session;
  }

  private resetRuntimeState(session: UserSession): void {
    session.clientInfo = null;
    session.qrCodeData = null;
    session.pairingCode = null;
    session.isChatStoreReady = false;
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

  private sanitizeClientInfo(clientInfo: any): SafeClientInfo | null {
    if (!clientInfo) {
      return null;
    }

    return {
      wid: clientInfo.wid
        ? {
            user: clientInfo.wid.user,
            _serialized: clientInfo.wid._serialized,
          }
        : undefined,
      pushname: clientInfo.pushname,
      platform: clientInfo.platform,
    };
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
    session.pendingPhoneNumber = phoneNumber || null;
    session.pairingCodeRequested = false;
    this.resetRuntimeState(session);

    const sessionPath = path.join('./wa-session', userId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const clientOptions: any = {
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
    };

    if (method === 'pairing' && phoneNumber) {
      clientOptions.pairWithPhoneNumber = {
        phoneNumber: phoneNumber.replace(/\D/g, '').replace(/^0/, '62'),
        showNotification: true,
        intervalMs: 180000
      };
    }

    session.client = new Client(clientOptions);

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
      
      // In pairing mode, whatsapp-web.js handles pairing code generation internally.
      if (session.connectionMethod === 'pairing') {
        return;
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
      session.isChatStoreReady = false;
      this.setStatus(userId, ConnectionStatus.AUTHENTICATED);
      this.emit('authenticated', userId);
      void this.waitForReadyState(userId);
    });

    session.client.on('auth_failure', (msg: string) => {
      console.error(`[${userId}] Authentication failure:`, msg);
      this.setStatus(userId, ConnectionStatus.AUTH_FAILURE);
      this.emit('auth_failure', userId, msg);
    });

    session.client.on('ready', () => {
      console.log(`[${userId}] WhatsApp client is ready`);
      session.clientInfo = this.sanitizeClientInfo(session.client?.info);
      this.setStatus(userId, ConnectionStatus.READY);
      void this.markChatStoreReady(userId, true);
    });

    session.client.on('disconnected', (reason: string) => {
      console.log(`[${userId}] WhatsApp disconnected:`, reason);
      this.resetRuntimeState(session);
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

  private async waitForReadyState(userId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client) return;

    for (let attempt = 0; attempt < 30; attempt++) {
      if (!session.client) return;
      if (session.status === ConnectionStatus.READY || session.status === ConnectionStatus.DISCONNECTED) {
        return;
      }

      try {
        const state = await (session.client as any).getState?.();
        const clientInfo = this.sanitizeClientInfo(session.client.info);

        if (state === 'CONNECTED' || clientInfo?.wid?._serialized) {
          console.log(`[${userId}] Ready state recovered via polling`);
          session.clientInfo = clientInfo;
          this.setStatus(userId, ConnectionStatus.READY);
          await this.markChatStoreReady(userId);
          return;
        }
      } catch {
        // Ignore transient readiness probe failures
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.warn(`[${userId}] Authenticated but ready event did not arrive in time`);
  }

  private async markChatStoreReady(userId: string, fastTrack = false): Promise<void> {
    const session = this.getSession(userId);
    session.isChatStoreReady = false;

    const attempts = fastTrack ? 5 : 8;
    const delayMs = fastTrack ? 600 : 1200;

    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!session.client || session.status === ConnectionStatus.DISCONNECTED) {
        return;
      }

      try {
        const chats = await this.getChatsSafe(userId);
        session.isChatStoreReady = true;
        this.emit('ready', userId, session.clientInfo);
        if (attempt > 0) {
          console.log(`[${userId}] Chat store ready after ${attempt + 1} attempts`);
        }
        return;
      } catch {
        // Wait for WhatsApp Web store to finish warming up
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    console.warn(`[${userId}] Ready event received but chat store is still warming up`);
  }

  private async ensureSendReady(userId: string): Promise<InstanceType<typeof Client>> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    if (!session.isChatStoreReady) {
      await this.markChatStoreReady(userId, true);
    }

    if (!session.isChatStoreReady) {
      throw new Error('WhatsApp chat store is still warming up');
    }

    return session.client;
  }

  private async sendWithRetry<T>(
    userId: string,
    chatId: string,
    execute: (client: InstanceType<typeof Client>) => Promise<T>
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < 4; attempt++) {
      const client = await this.ensureSendReady(userId);

      try {
        await this.prepareChatForSend(userId, client, chatId);
        return await execute(client);
      } catch (error: any) {
        lastError = error;
        const errorMsg = error?.message || '';

        if (errorMsg.includes('No LID') || errorMsg.includes('not registered')) {
          throw new Error('Number is not registered on WhatsApp');
        }

        const isTransientError =
          errorMsg.includes('markedUnread') ||
          errorMsg.includes('chat not ready') ||
          errorMsg.includes('findChat') ||
          errorMsg.includes('serialize') ||
          errorMsg.includes('WidFactory') ||
          errorMsg.includes('sendSeen') ||
          errorMsg.includes('evaluation failed');

        if (!isTransientError || attempt === 3) {
          if (errorMsg.includes('chat not ready') || errorMsg.includes('findChat')) {
            throw new Error('Unable to send message - chat not ready');
          }
          throw error;
        }

        const session = this.getSession(userId);
        session.isChatStoreReady = false;
        await new Promise(resolve => setTimeout(resolve, 1200 * (attempt + 1)));
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Unable to send message');
  }

  private async prepareChatForSend(
    userId: string,
    client: InstanceType<typeof Client>,
    chatId: string
  ): Promise<void> {
    try {
      await this.ensureChatExists(client, chatId);
      await client.getChatById(chatId);
      return;
    } catch {
      // Fall through to browser store warm-up
    }

    const page = (client as any)?.pupPage;
    if (!page) {
      return;
    }

    try {
      await page.evaluate(async (id: string) => {
        const store = (window as any).Store;
        const chat = (window as any).WWebJS?.getChat
          ? await (window as any).WWebJS.getChat(id)
          : await store?.Chat?.find?.(id);

        if (!chat) {
          throw new Error('Chat not found in browser store');
        }

        return true;
      }, chatId);
    } catch (error) {
      console.warn(`[${userId}] Browser chat warm-up failed for ${chatId}`);
    }
  }

  private async sendMessageWithoutSeen(
    userId: string,
    client: InstanceType<typeof Client>,
    chatId: string,
    content: any,
    options?: Record<string, unknown>
  ): Promise<any> {
    const sendOptions = {
      ...(options ?? {}),
      sendSeen: false,
    };

    console.log(`[${userId}] Primary send start for ${chatId} (sendSeen=false)`);

    try {
      const result = await (client as any).sendMessage(chatId, content, sendOptions);
      console.log(`[${userId}] Primary send success for ${chatId}`);
      return result;
    } catch (error: any) {
      console.warn(`[${userId}] Primary send failed for ${chatId}: ${error?.message || error}`);
      throw error;
    }
  }

  private async sendTextViaBrowserStore(userId: string, chatId: string, content: string): Promise<any> {
    const session = this.getSession(userId);
    const page = (session.client as any)?.pupPage;

    if (!page) {
      throw new Error('Browser page is not available for fallback send');
    }

    const result = await page.evaluate(async (payload: { chatId: string; content: string }) => {
      const { chatId, content } = payload;
      const w = window as any;
      const Store = w.Store;
      const WWebJS = w.WWebJS;

      let chat = null;

      try {
        if (typeof WWebJS?.getChat === 'function') {
          chat = await WWebJS.getChat(chatId);
        }
      } catch {
        // Ignore and try Store fallback
      }

      if (!chat && typeof Store?.Chat?.find === 'function') {
        chat = await Store.Chat.find(chatId);
      }

      if (!chat) {
        throw new Error('Chat not found in browser store');
      }

      let sentResult: any = null;

      if (typeof WWebJS?.sendMessage === 'function') {
        try {
          console.log(`[${userId}] Browser fallback try WWebJS.sendMessage for ${chatId}`);
          sentResult = await WWebJS.sendMessage(chat, content, {});
          if (sentResult) {
            console.log(`[${userId}] Browser fallback success via WWebJS.sendMessage for ${chatId}`);
          }
        } catch {
          sentResult = null;
        }
      }

      if (!sentResult && typeof chat.sendMessage === 'function') {
        try {
          console.log(`[${userId}] Browser fallback try chat.sendMessage for ${chatId}`);
          sentResult = await chat.sendMessage(content);
          if (sentResult) {
            console.log(`[${userId}] Browser fallback success via chat.sendMessage for ${chatId}`);
          }
        } catch {
          sentResult = null;
        }
      }

      if (!sentResult && typeof Store?.SendTextMsgToChat === 'function') {
        try {
          console.log(`[${userId}] Browser fallback try Store.SendTextMsgToChat for ${chatId}`);
          sentResult = await Store.SendTextMsgToChat(chat, content);
          if (sentResult) {
            console.log(`[${userId}] Browser fallback success via Store.SendTextMsgToChat for ${chatId}`);
          }
        } catch {
          sentResult = null;
        }
      }

      if (!sentResult && typeof Store?.Cmd?.sendTextMsgToChat === 'function') {
        try {
          console.log(`[${userId}] Browser fallback try Store.Cmd.sendTextMsgToChat for ${chatId}`);
          sentResult = await Store.Cmd.sendTextMsgToChat(chat, content);
          if (sentResult) {
            console.log(`[${userId}] Browser fallback success via Store.Cmd.sendTextMsgToChat for ${chatId}`);
          }
        } catch {
          sentResult = null;
        }
      }

      if (!sentResult) {
        throw new Error('No browser-store text send method available');
      }

      const serializedId =
        sentResult?.id?._serialized ||
        sentResult?.id?.id ||
        sentResult?.id ||
        `${chatId}-${Date.now()}`;

      return {
        id: { _serialized: String(serializedId) },
        timestamp: sentResult?.t || sentResult?.timestamp || Math.floor(Date.now() / 1000),
        body: sentResult?.body || content,
        from: sentResult?.from?._serialized || sentResult?.from || null,
        to: sentResult?.to?._serialized || sentResult?.to || chatId,
        _fallback: 'browser-store-text',
      };
    }, { chatId, content });

    console.warn(`[${userId}] Text sent via browser store fallback for ${chatId}`);
    return result;
  }

  private async ensureChatExists(client: any, chatId: string): Promise<void> {
    try {
      // Try to get or create the chat
      await client.pupPage?.evaluate((id: string) => {
        return (window as any).WWebJS?.getChat(id);
      }, chatId);
    } catch (error) {
      // If chat doesn't exist, this is fine - sendMessage will create it
    }
  }

  private async resolvePhoneForSend(userId: string, phone: string): Promise<string> {
    const cleaned = phone.replace(/\D/g, '');
    const session = this.getSession(userId);
    const client = session.client as any;

    if (!client || !cleaned) {
      return cleaned;
    }

    try {
      const numberId = await client.getNumberId(cleaned);
      const resolvedId = numberId?._serialized;
      if (resolvedId) {
        if (resolvedId !== cleaned && resolvedId !== `${cleaned}@c.us`) {
          console.log(`[${userId}] Resolved send target ${cleaned} -> ${resolvedId} via getNumberId`);
        }
        return resolvedId;
      }
    } catch (error: any) {
      console.warn(`[${userId}] getNumberId failed for ${cleaned}: ${error?.message || error}`);
    }

    if (typeof client.getContacts !== 'function' || typeof client.getContactLidAndPhone !== 'function') {
      return cleaned;
    }

    try {
      const contacts = await client.getContacts();
      const matchedContact = contacts.find((contact: any) => {
        const contactNumber = String(contact?.number || '').replace(/\D/g, '');
        const contactUser = String(contact?.id?.user || '').replace(/\D/g, '');
        const serializedId = String(contact?.id?._serialized || '');

        return (
          contactNumber === cleaned ||
          contactUser === cleaned ||
          serializedId === `${cleaned}@c.us` ||
          serializedId === `${cleaned}@lid`
        );
      });

      if (!matchedContact?.id?._serialized) {
        return cleaned;
      }

      const mappings = await client.getContactLidAndPhone([matchedContact.id._serialized]);
      const resolvedPhone = mappings?.[0]?.pn;
      if (typeof resolvedPhone === 'string' && resolvedPhone.endsWith('@c.us')) {
        if (resolvedPhone !== `${cleaned}@c.us`) {
          console.log(`[${userId}] Resolved send target ${cleaned} -> ${resolvedPhone} via contact mapping ${matchedContact.id._serialized}`);
        }
        return resolvedPhone;
      }
    } catch (error: any) {
      console.warn(`[${userId}] Contact mapping lookup failed for ${cleaned}: ${error?.message || error}`);
    }

    return cleaned;
  }

  async sendTextMessage(userId: string, phone: string, content: string): Promise<any> {
    const resolvedPhone = await this.resolvePhoneForSend(userId, phone);
    const chatId = this.formatPhoneNumber(resolvedPhone);

    try {
      return await this.sendWithRetry(userId, chatId, async client => {
        try {
          return await this.sendMessageWithoutSeen(userId, client, chatId, content);
        } catch (error: any) {
          if ((error.message || '').includes('markedUnread')) {
            console.log(`[${userId}] Retrying send after markedUnread error`);
          }
          throw error;
        }
      });
    } catch (error: any) {
      const errorMsg = error?.message || '';
      const shouldUseBrowserFallback =
        errorMsg.includes('markedUnread') ||
        errorMsg.includes('sendSeen') ||
        errorMsg.includes('evaluation failed') ||
        errorMsg.includes('chat not ready') ||
        errorMsg.includes('findChat') ||
        errorMsg.includes('serialize') ||
        errorMsg.includes('WidFactory');

      if (shouldUseBrowserFallback) {
        console.warn(`[${userId}] sendMessage failed for ${chatId}, trying browser-store text fallback: ${errorMsg}`);
        return await this.sendTextViaBrowserStore(userId, chatId, content);
      }

      throw error;
    }
  }

  async sendMediaMessage(
    userId: string,
    phone: string,
    mediaPath: string,
    caption?: string,
    type: MessageType = MessageType.IMAGE
  ): Promise<any> {
    const resolvedPhone = await this.resolvePhoneForSend(userId, phone);
    const chatId = this.formatPhoneNumber(resolvedPhone);
    const media = MessageMedia.fromFilePath(mediaPath);

    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    if (type === MessageType.DOCUMENT) {
      options.sendMediaAsDocument = true;
    }

    return await this.sendWithRetry(userId, chatId, async client => {
      try {
        return await this.sendMessageWithoutSeen(userId, client, chatId, media, options);
      } catch (error: any) {
        if ((error.message || '').includes('markedUnread')) {
          console.log(`[${userId}] Retrying media send after markedUnread error`);
        }
        throw error;
      }
    });
  }

  async sendMediaFromUrl(
    userId: string,
    phone: string,
    url: string,
    caption?: string,
    type: MessageType = MessageType.IMAGE
  ): Promise<any> {
    const resolvedPhone = await this.resolvePhoneForSend(userId, phone);
    const chatId = this.formatPhoneNumber(resolvedPhone);
    const media = await MessageMedia.fromUrl(url);
    
    const options: any = {};
    if (caption) {
      options.caption = caption;
    }
    if (type === MessageType.DOCUMENT) {
      options.sendMediaAsDocument = true;
    }

    return await this.sendWithRetry(userId, chatId, async client =>
      this.sendMessageWithoutSeen(userId, client, chatId, media, options)
    );
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

    const chats = await this.getChatsSafe(userId);
    const contactsMap = new Map<string, Contact>();

    for (const chat of chats) {
      try {
        const chatId = (chat as any).id._serialized;
        const isGroup = (chat as any).isGroup;
        
        if (!isGroup) {
          // Extract info directly from chat without calling getContact()
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

    return await this.getChatsSafe(userId);
  }

  private async getChatsSafe(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client) {
      throw new Error('WhatsApp client is not initialized');
    }

    try {
      return await session.client.getChats();
    } catch (error) {
      console.warn(`[${userId}] client.getChats() failed, trying browser store fallback`);
      const fallbackChats = await this.getChatsFromBrowserStore(userId);
      if (fallbackChats.length > 0) {
        return fallbackChats;
      }
      throw error;
    }
  }

  private async getChatsFromBrowserStore(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    const page = (session.client as any)?.pupPage;
    if (!page) return [];

    try {
      const chats = await page.evaluate(() => {
        const store = (window as any).Store;
        const models =
          store?.Chat?.getModelsArray?.() ||
          Object.values(store?.Chat?._models || {});

        return (models || []).map((chat: any) => ({
          id: {
            _serialized: chat?.id?._serialized || chat?.id || '',
          },
          name:
            chat?.name ||
            chat?.formattedTitle ||
            chat?.contact?.name ||
            chat?.contact?.pushname ||
            'Unknown',
          isGroup: !!chat?.isGroup,
          isReadOnly: !!chat?.isReadOnly,
          unreadCount: chat?.unreadCount || 0,
          timestamp: chat?.timestamp || chat?.t || 0,
          archived: !!(chat?.archived ?? chat?.archive),
          pinned: !!(chat?.pinned ?? chat?.pin),
          isMuted: !!chat?.isMuted,
          muteExpiration: chat?.muteExpiration || 0,
          lastMessage: chat?.lastMessage
            ? {
                body: chat.lastMessage.body || '',
                timestamp: chat.lastMessage.timestamp || chat.lastMessage.t || 0,
                fromMe: !!chat.lastMessage.fromMe,
              }
            : null,
        }));
      });

      return Array.isArray(chats) ? chats.filter((chat: any) => chat?.id?._serialized) : [];
    } catch (error) {
      console.error(`[${userId}] Browser store fallback failed:`, (error as Error).message);
      return [];
    }
  }

  async checkNumberRegistered(userId: string, phone: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const resolvedPhone = await this.resolvePhoneForSend(userId, phone);
    const chatId = this.formatPhoneNumber(resolvedPhone);
    const result = await session.client.isRegisteredUser(chatId);
    return result;
  }

  private formatPhoneNumber(phone: string): string {
    if (phone.includes('@')) {
      return phone;
    }

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
    const resolvedPhone = await this.resolvePhoneForSend(userId, phone);
    const chatId = this.formatPhoneNumber(resolvedPhone);
    const poll = new Poll(pollData.question, pollData.options);

    return await this.sendWithRetry(userId, chatId, async client => {
      try {
        return await this.sendMessageWithoutSeen(userId, client, chatId, poll);
      } catch (error: any) {
        if ((error.message || '').includes('markedUnread')) {
          console.log(`[${userId}] Retrying poll send after markedUnread error`);
        }
        throw error;
      }
    });
  }

  // Send Location
  async sendLocation(userId: string, phone: string, locationData: LocationData): Promise<any> {
    const resolvedPhone = await this.resolvePhoneForSend(userId, phone);
    const chatId = this.formatPhoneNumber(resolvedPhone);
    const location = new Location(locationData.latitude, locationData.longitude, {
      name: locationData.description || ''
    });

    return await this.sendWithRetry(userId, chatId, async client => {
      try {
        return await this.sendMessageWithoutSeen(userId, client, chatId, location);
      } catch (error: any) {
        if ((error.message || '').includes('markedUnread')) {
          console.log(`[${userId}] Retrying location send after markedUnread error`);
        }
        throw error;
      }
    });
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

    const chats = await this.getChatsSafe(userId);
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

  // ==================== CONTACT METHODS ====================

  async getContactById(userId: string, contactId: string): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contact = await session.client.getContactById(contactId);
      return {
        id: (contact as any).id._serialized,
        number: (contact as any).number || contactId.replace('@c.us', '').replace('@g.us', ''),
        name: (contact as any).name || null,
        pushname: (contact as any).pushname || '',
        shortName: (contact as any).shortName || null,
        isBlocked: (contact as any).isBlocked || false,
        isBusiness: (contact as any).isBusiness || false,
        isEnterprise: (contact as any).isEnterprise || false,
        isGroup: (contact as any).isGroup || contactId.includes('@g.us'),
        isMe: (contact as any).isMe || false,
        isMyContact: (contact as any).isMyContact || false,
        isUser: (contact as any).isUser || contactId.includes('@c.us'),
        isWAContact: (contact as any).isWAContact !== false
      };
    } catch (error) {
      // Fallback: get from chat if contact method fails
      console.log(`[${userId}] getContactById failed, trying via chat`);
      try {
        const chat = await session.client.getChatById(contactId);
        const chatName = (chat as any).name || (chat as any).formattedTitle || '';
        return {
          id: contactId,
          number: contactId.replace('@c.us', '').replace('@g.us', ''),
          name: chatName || null,
          pushname: chatName || '',
          shortName: null,
          isBlocked: false,
          isBusiness: false,
          isEnterprise: false,
          isGroup: contactId.includes('@g.us'),
          isMe: false,
          isMyContact: false,
          isUser: contactId.includes('@c.us'),
          isWAContact: true
        };
      } catch {
        // Last resort: return minimal info
        return {
          id: contactId,
          number: contactId.replace('@c.us', '').replace('@g.us', ''),
          name: null,
          pushname: '',
          shortName: null,
          isBlocked: false,
          isBusiness: false,
          isEnterprise: false,
          isGroup: contactId.includes('@g.us'),
          isMe: false,
          isMyContact: false,
          isUser: contactId.includes('@c.us'),
          isWAContact: true
        };
      }
    }
  }

  async getAllContacts(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contacts = await session.client.getContacts();
      const phoneMap = await this.resolveContactPhoneNumbers(userId, contacts.map((contact: any) => contact.id._serialized));

      return contacts.map((contact: any) => ({
        id: contact.id._serialized,
        number:
          phoneMap.get(contact.id._serialized) ||
          contact.number ||
          contact.id._serialized.replace('@c.us', '').replace('@g.us', ''),
        name: contact.name,
        pushname: contact.pushname,
        shortName: contact.shortName,
        isBlocked: contact.isBlocked || false,
        isBusiness: contact.isBusiness || false,
        isEnterprise: contact.isEnterprise || false,
        isGroup: contact.isGroup || contact.id.server === 'g.us',
        isMe: contact.isMe || false,
        isMyContact: contact.isMyContact || false,
        isUser: contact.isUser || contact.id.server === 'c.us',
        isWAContact: contact.isWAContact || true
      }));
    } catch (error) {
      console.log(`[${userId}] getAllContacts failed, falling back to getChats method`);
      return await this.getAllContactsFromChats(userId);
    }
  }

  private async resolveContactPhoneNumbers(userId: string, contactIds: string[]): Promise<Map<string, string>> {
    const session = this.getSession(userId);
    const client = session.client as any;

    if (!client || typeof client.getContactLidAndPhone !== 'function') {
      return new Map();
    }

    const userContactIds = contactIds.filter(contactId => contactId.endsWith('@c.us') || contactId.endsWith('@lid'));
    if (userContactIds.length === 0) {
      return new Map();
    }

    try {
      const mappings = await client.getContactLidAndPhone(userContactIds);
      const phoneMap = new Map<string, string>();

      userContactIds.forEach((contactId: string, index: number) => {
        const mapping = mappings?.[index];
        const phoneId = mapping?.pn;
        if (typeof phoneId === 'string' && phoneId.endsWith('@c.us')) {
          phoneMap.set(contactId, phoneId.replace('@c.us', ''));
        }
      });

      if (phoneMap.size > 0) {
        console.log(`[${userId}] Resolved ${phoneMap.size} contact phone numbers via LID mapping`);
      }

      return phoneMap;
    } catch (error: any) {
      console.warn(`[${userId}] Failed to resolve contact phone numbers: ${error?.message || error}`);
      return new Map();
    }
  }

  async getAllContactsFromChats(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.getChatsSafe(userId);
    const contactsList: any[] = [];

    for (const chat of chats) {
      try {
        const chatId = (chat as any).id._serialized;
        const isGroup = (chat as any).isGroup;
        
        if (!isGroup) {
          // Extract info directly from chat without calling getContact()
          const number = chatId.replace('@c.us', '');
          
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
          
          // Don't use phone number as name - leave empty if no name found
          const displayName = (contactName && contactName !== number && !contactName.startsWith('+')) 
            ? contactName 
            : '';
          
          contactsList.push({
            id: chatId,
            number: number,
            name: displayName || null,
            pushname: chatData.pushname || chatData.notifyName || '',
            shortName: chatData.shortName || null,
            isBlocked: false,
            isBusiness: chatData.isBusiness || false,
            isEnterprise: chatData.isEnterprise || false,
            isGroup: false,
            isMe: false,
            isMyContact: !!chatData.isAddressBookContact,
            isUser: true,
            isWAContact: true
          });
        } else {
          contactsList.push({
            id: chatId,
            number: '',
            name: (chat as any).name || 'Unknown Group',
            pushname: '',
            shortName: null,
            isBlocked: false,
            isBusiness: false,
            isEnterprise: false,
            isGroup: true,
            isMe: false,
            isMyContact: false,
            isUser: false,
            isWAContact: true
          });
        }
      } catch (err) {
        console.error(`[${userId}] Error loading contact from chat:`, err);
      }
    }

    return contactsList;
  }

  async getContactProfilePicUrl(userId: string, contactId: string): Promise<string | null> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contact = await session.client.getContactById(contactId);
      return await contact.getProfilePicUrl();
    } catch {
      return null;
    }
  }

  async getContactAbout(userId: string, contactId: string): Promise<string | null> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    try {
      const contact = await session.client.getContactById(contactId);
      return await contact.getAbout();
    } catch {
      return null;
    }
  }

  async getContactFormattedNumber(userId: string, contactId: string): Promise<string> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const contact = await session.client.getContactById(contactId);
    return await contact.getFormattedNumber();
  }

  async getContactCountryCode(userId: string, contactId: string): Promise<string> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const contact = await session.client.getContactById(contactId);
    return await contact.getCountryCode();
  }

  async getContactCommonGroups(userId: string, contactId: string): Promise<string[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const contact = await session.client.getContactById(contactId);
    const groups = await contact.getCommonGroups();
    return groups.map((g: any) => g._serialized || g);
  }

  async blockContact(userId: string, contactId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const contact = await session.client.getContactById(contactId);
    return await contact.block();
  }

  async unblockContact(userId: string, contactId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const contact = await session.client.getContactById(contactId);
    return await contact.unblock();
  }

  async getBlockedContacts(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const blockedContacts = await session.client.getBlockedContacts();
    return blockedContacts.map((contact: any) => ({
      id: contact.id._serialized,
      number: contact.number,
      name: contact.name,
      pushname: contact.pushname
    }));
  }

  // ==================== CHAT METHODS ====================

  async getAllChats(userId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chats = await this.getChatsSafe(userId);
    return chats.map((chat: any) => ({
      id: chat.id._serialized,
      name: chat.name || chat.formattedTitle || 'Unknown',
      isGroup: chat.isGroup,
      isReadOnly: chat.isReadOnly,
      unreadCount: chat.unreadCount,
      timestamp: chat.timestamp,
      archived: chat.archived,
      pinned: chat.pinned,
      isMuted: chat.isMuted,
      muteExpiration: chat.muteExpiration,
      lastMessage: chat.lastMessage ? {
        body: chat.lastMessage.body,
        timestamp: chat.lastMessage.timestamp,
        fromMe: chat.lastMessage.fromMe
      } : null
    }));
  }

  async getChatById(userId: string, chatId: string): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return {
      id: (chat as any).id._serialized,
      name: (chat as any).name || (chat as any).formattedTitle || 'Unknown',
      isGroup: (chat as any).isGroup,
      isReadOnly: (chat as any).isReadOnly,
      unreadCount: (chat as any).unreadCount,
      timestamp: (chat as any).timestamp,
      archived: (chat as any).archived,
      pinned: (chat as any).pinned,
      isMuted: (chat as any).isMuted,
      muteExpiration: (chat as any).muteExpiration
    };
  }

  async fetchChatMessages(userId: string, chatId: string, options?: { limit?: number; fromMe?: boolean }): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    const messages = await chat.fetchMessages(options || {});
    return messages.map((msg: any) => ({
      id: msg.id._serialized,
      body: msg.body,
      type: msg.type,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe,
      from: msg.from,
      to: msg.to,
      hasMedia: msg.hasMedia,
      isForwarded: msg.isForwarded,
      isStarred: msg.isStarred
    }));
  }

  async sendMessageToChat(userId: string, chatId: string, content: string, options?: any): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    if (!options || Object.keys(options).length === 0) {
      return await this.sendTextMessage(userId, chatId, content);
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.sendMessage(content, options);
  }

  async sendSeenToChat(userId: string, chatId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.sendSeen();
  }

  async archiveChat(userId: string, chatId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.archive();
  }

  async unarchiveChat(userId: string, chatId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.unarchive();
  }

  async pinChat(userId: string, chatId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.pin();
  }

  async unpinChat(userId: string, chatId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.unpin();
  }

  async muteChat(userId: string, chatId: string, unmuteDate?: Date): Promise<{ isMuted: boolean; muteExpiration: number }> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.mute(unmuteDate);
  }

  async unmuteChat(userId: string, chatId: string): Promise<{ isMuted: boolean; muteExpiration: number }> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.unmute();
  }

  async markChatUnread(userId: string, chatId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.markUnread();
  }

  async clearChatMessages(userId: string, chatId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.clearMessages();
  }

  async deleteChat(userId: string, chatId: string): Promise<boolean> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.delete();
  }

  async getChatContact(userId: string, chatId: string): Promise<any> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    const chatName = (chat as any).name || (chat as any).formattedTitle || '';
    const isGroup = chatId.includes('@g.us');
    
    return {
      id: chatId,
      name: chatName || 'Unknown',
      number: isGroup ? '' : chatId.replace('@c.us', ''),
      pushname: chatName,
      isGroup: isGroup,
      isWAContact: true
    };
  }

  async sendTypingState(userId: string, chatId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.sendStateTyping();
  }

  async sendRecordingState(userId: string, chatId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.sendStateRecording();
  }

  async clearChatState(userId: string, chatId: string): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.clearState();
  }

  async getPinnedMessages(userId: string, chatId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    const messages = await chat.getPinnedMessages();
    return (messages || []).map((msg: any) => ({
      id: msg.id._serialized,
      body: msg.body,
      type: msg.type,
      timestamp: msg.timestamp,
      fromMe: msg.fromMe
    }));
  }

  async getChatLabels(userId: string, chatId: string): Promise<any[]> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    return await chat.getLabels();
  }

  async changeChatLabels(userId: string, chatId: string, labelIds: (string | number)[]): Promise<void> {
    const session = this.getSession(userId);
    if (!session.client || session.status !== ConnectionStatus.READY) {
      throw new Error('WhatsApp client is not ready');
    }

    const chat = await session.client.getChatById(chatId);
    await chat.changeLabels(labelIds);
  }

  isReady(userId: string): boolean {
    const session = this.getSession(userId);
    return session.status === ConnectionStatus.READY && session.isChatStoreReady;
  }

  hasActiveSession(userId: string): boolean {
    const session = this.sessions.get(userId);
    return session?.client !== null && session?.status !== ConnectionStatus.DISCONNECTED;
  }
}

export const whatsappSessionManager = new WhatsAppSessionManager();
