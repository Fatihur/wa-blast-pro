import { io, Socket } from 'socket.io-client';

type EventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<EventCallback>> = new Map();

  connect(url: string = 'http://localhost:3001'): void {
    if (this.socket?.connected) {
      return;
    }

    const token = localStorage.getItem('authToken');
    
    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      auth: {
        token
      }
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
      this.emit('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.emit('disconnected', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      if (error.message === 'Authentication required' || error.message === 'Invalid token') {
        this.emit('auth_error', error.message);
      }
    });

    // WhatsApp events
    this.socket.on('whatsapp_status', (data) => this.emit('whatsapp_status', data));
    this.socket.on('whatsapp_qr', (data) => this.emit('whatsapp_qr', data));
    this.socket.on('whatsapp_ready', (data) => this.emit('whatsapp_ready', data));
    this.socket.on('whatsapp_authenticated', () => this.emit('whatsapp_authenticated'));
    this.socket.on('whatsapp_auth_failure', (data) => this.emit('whatsapp_auth_failure', data));
    this.socket.on('whatsapp_disconnected', (data) => this.emit('whatsapp_disconnected', data));

    // Blast events
    this.socket.on('blast_job_created', (data) => this.emit('blast_job_created', data));
    this.socket.on('blast_job_started', (data) => this.emit('blast_job_started', data));
    this.socket.on('blast_progress', (data) => this.emit('blast_progress', data));
    this.socket.on('blast_job_completed', (data) => this.emit('blast_job_completed', data));
    this.socket.on('blast_job_paused', (data) => this.emit('blast_job_paused', data));
    this.socket.on('blast_job_failed', (data) => this.emit('blast_job_failed', data));
    this.socket.on('blast_job_cancelled', (data) => this.emit('blast_job_cancelled', data));

    // Dashboard stats event
    this.socket.on('dashboard_stats', (data) => this.emit('dashboard_stats', data));
  }

  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
