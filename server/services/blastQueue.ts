import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { BlastJob, BlastResult, CreateBlastPayload, MessageType, Recipient, PollData, LocationData } from '../types.js';
import { whatsappSessionManager } from './whatsappSessionManager.js';
import { blastRepository } from '../repositories/blastRepository.js';

interface UserJobState {
  currentJob: BlastJob | null;
  isProcessing: boolean;
  abortController: AbortController | null;
}

class BlastQueueService extends EventEmitter {
  private jobs: Map<string, BlastJob> = new Map();
  private userStates: Map<string, UserJobState> = new Map();

  constructor() {
    super();
  }

  private getUserState(userId: string): UserJobState {
    let state = this.userStates.get(userId);
    if (!state) {
      state = {
        currentJob: null,
        isProcessing: false,
        abortController: null
      };
      this.userStates.set(userId, state);
    }
    return state;
  }

  createJob(userId: string, payload: CreateBlastPayload, existingId?: string): BlastJob {
    const messageData: any = {
      id: uuidv4(),
      type: payload.type,
      content: payload.content,
      mediaPath: payload.mediaPath,
      mediaName: payload.mediaName
    };

    // Add poll/location data if present
    if (payload.pollData) {
      messageData.pollData = payload.pollData;
    }
    if (payload.locationData) {
      messageData.locationData = payload.locationData;
    }

    const job: BlastJob = {
      id: existingId || uuidv4(),
      userId,
      message: messageData,
      recipients: payload.recipients,
      status: 'pending',
      progress: {
        total: payload.recipients.length,
        sent: 0,
        failed: 0,
        current: 0
      },
      results: [],
      createdAt: new Date(),
      delayMs: payload.delayMs || 3000
    };

    this.jobs.set(job.id, job);
    this.emit('job_created', userId, job);
    return job;
  }

  async startJob(userId: string, jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized to access this job');
    }

    if (!whatsappSessionManager.isReady(userId)) {
      throw new Error('WhatsApp client is not ready');
    }

    const state = this.getUserState(userId);
    if (state.isProcessing) {
      throw new Error('Another job is already running');
    }

    state.isProcessing = true;
    state.currentJob = job;
    state.abortController = new AbortController();
    
    job.status = 'running';
    job.startedAt = new Date();
    this.emit('job_started', userId, job);

    try {
      await this.processJob(userId, job, state);
    } catch (error) {
      if ((job.status as string) !== 'paused') {
        job.status = 'failed';
        this.emit('job_failed', userId, job, error);
      }
    } finally {
      state.isProcessing = false;
      state.currentJob = null;
      state.abortController = null;
    }
  }

  private async processJob(userId: string, job: BlastJob, state: UserJobState): Promise<void> {
    const { recipients, message, delayMs } = job;

    for (let i = job.progress.current; i < recipients.length; i++) {
      if (state.abortController?.signal.aborted) {
        break;
      }

      if ((job.status as string) === 'paused') {
        break;
      }

      const recipient = recipients[i];
      job.progress.current = i;

      const result: BlastResult = {
        phone: recipient.phone,
        status: 'failed',
        timestamp: new Date()
      };

      try {
        const personalizedContent = this.personalizeMessage(message.content, recipient);

        let messageResult: any;

        if (message.type === MessageType.TEXT) {
          messageResult = await whatsappSessionManager.sendTextMessage(userId, recipient.phone, personalizedContent);
        } else if (message.type === MessageType.POLL && (message as any).pollData) {
          const pollData = (message as any).pollData as PollData;
          messageResult = await whatsappSessionManager.sendPoll(userId, recipient.phone, pollData);
        } else if (message.type === MessageType.LOCATION && (message as any).locationData) {
          const locationData = (message as any).locationData as LocationData;
          messageResult = await whatsappSessionManager.sendLocation(userId, recipient.phone, locationData);
        } else if (message.mediaPath) {
          messageResult = await whatsappSessionManager.sendMediaMessage(
            userId,
            recipient.phone,
            message.mediaPath,
            personalizedContent,
            message.type
          );
        } else {
          throw new Error('Invalid message type or missing data');
        }

        result.status = 'success';
        result.messageId = messageResult.id?._serialized;
        job.progress.sent++;
      } catch (error: any) {
        result.status = 'failed';
        result.error = error.message || 'Unknown error';
        job.progress.failed++;
        console.error(`[${userId}] Failed to send to ${recipient.phone}:`, error.message);
      }

      job.results.push(result);
      this.emit('message_sent', userId, job, result);

      try {
        await blastRepository.updateJobProgress(
          job.id,
          job.progress.sent,
          job.progress.failed,
          job.progress.current
        );
      } catch (err) {
        console.error('Failed to sync progress to database:', err);
      }

      if (i < recipients.length - 1 && job.status === 'running') {
        const randomDelay = delayMs + Math.random() * 2000;
        await this.sleep(randomDelay, state.abortController);
      }
    }

    if (job.status === 'running') {
      job.status = 'completed';
      job.completedAt = new Date();
      
      try {
        await blastRepository.updateJobStatus(job.id, 'completed');
        await blastRepository.updateJobProgress(
          job.id,
          job.progress.sent,
          job.progress.failed,
          job.progress.current
        );
      } catch (err) {
        console.error('Failed to sync completion to database:', err);
      }
      
      this.emit('job_completed', userId, job);
    }
  }

  private personalizeMessage(content: string, recipient: Recipient): string {
    return content
      .replace(/{phone}/g, recipient.phone)
      .replace(/{name}/g, recipient.name);
  }

  private sleep(ms: number, abortController: AbortController | null): Promise<void> {
    return new Promise((resolve) => {
      const timeout = setTimeout(resolve, ms);
      abortController?.signal.addEventListener('abort', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  pauseJob(userId: string, jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'running') {
      throw new Error('Job not found or not running');
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized to access this job');
    }

    const state = this.getUserState(userId);
    job.status = 'paused';
    state.abortController?.abort();
    this.emit('job_paused', userId, job);
  }

  async resumeJob(userId: string, jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'paused') {
      throw new Error('Job not found or not paused');
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized to access this job');
    }

    await this.startJob(userId, jobId);
  }

  cancelJob(userId: string, jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized to access this job');
    }

    const state = this.getUserState(userId);
    if (job.status === 'running') {
      state.abortController?.abort();
    }

    job.status = 'failed';
    this.emit('job_cancelled', userId, job);
  }

  getJob(userId: string, jobId: string): BlastJob | undefined {
    const job = this.jobs.get(jobId);
    if (job && job.userId === userId) {
      return job;
    }
    return undefined;
  }

  getAllJobs(userId: string): BlastJob[] {
    return Array.from(this.jobs.values())
      .filter(job => job.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  deleteJob(userId: string, jobId: string): boolean {
    const job = this.jobs.get(jobId);
    if (!job) {
      return false;
    }

    if (job.userId !== userId) {
      throw new Error('Unauthorized to access this job');
    }

    if (job.status === 'running') {
      throw new Error('Cannot delete a running job');
    }

    return this.jobs.delete(jobId);
  }

  getCurrentJob(userId: string): BlastJob | null {
    return this.getUserState(userId).currentJob;
  }
}

export const blastQueue = new BlastQueueService();
