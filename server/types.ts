export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  POLL = 'POLL',
  LOCATION = 'LOCATION',
  CONTACT = 'CONTACT'
}

export interface PollData {
  question: string;
  options: string[];
  allowMultiple?: boolean;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  description?: string;
}

export interface ContactCardData {
  name: string;
  phone: string;
}

export interface WhatsAppGroup {
  id: string;
  name: string;
  participantsCount: number;
  isAdmin: boolean;
}

export enum ConnectionStatus {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  QR_READY = 'QR_READY',
  AUTHENTICATED = 'AUTHENTICATED',
  READY = 'READY',
  AUTH_FAILURE = 'AUTH_FAILURE'
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  pushname?: string;
  isGroup: boolean;
}

export interface BlastMessage {
  id: string;
  type: MessageType;
  content: string;
  mediaPath?: string;
  mediaName?: string;
}

export interface Recipient {
  phone: string;
  name: string;
}

export interface BlastJob {
  id: string;
  userId: string;
  message: BlastMessage;
  recipients: Recipient[];
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    total: number;
    sent: number;
    failed: number;
    current: number;
  };
  results: BlastResult[];
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  delayMs: number;
}

export interface BlastResult {
  phone: string;
  status: 'success' | 'failed';
  messageId?: string;
  error?: string;
  timestamp: Date;
}

export interface SendMessagePayload {
  phone: string;
  type: MessageType;
  content: string;
  mediaPath?: string;
  mediaName?: string;
}

export interface CreateBlastPayload {
  type: MessageType;
  content: string;
  recipients: Recipient[];
  mediaPath?: string;
  mediaName?: string;
  delayMs?: number;
  pollData?: PollData;
  locationData?: LocationData;
}
