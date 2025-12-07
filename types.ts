
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  DOCUMENT = 'DOCUMENT',
  POLL = 'POLL',
  LOCATION = 'LOCATION'
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

export interface WhatsAppGroup {
  id: string;
  name: string;
  participantsCount: number;
  isAdmin: boolean;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  tags: string[];
}

export interface Group {
  id: string;
  name: string;
  contactIds: string[];
}

export interface BlastHistory {
  id: string;
  date: string;
  message: string;
  recipients: number;
  success: number;
  failed: number;
  status: 'Completed' | 'Sending' | 'Failed';
  type: MessageType;
}

export interface DashboardStats {
  totalSent: number;
  delivered: number;
  pending: number;
  failed: number;
}

export type ViewState = 'dashboard' | 'contacts' | 'blast' | 'connection' | 'history' | 'settings' | 'files' | 'scheduled' | 'chat';
