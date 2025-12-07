import { blastRepository } from '../repositories/blastRepository.js';
import { blastQueue } from './blastQueue.js';
import { whatsappSessionManager } from './whatsappSessionManager.js';
import { CreateBlastPayload, MessageType, Recipient } from '../types.js';

class SchedulerService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkIntervalMs = 30000; // Check every 30 seconds

  start() {
    if (this.intervalId) {
      console.log('[Scheduler] Already running');
      return;
    }

    console.log('[Scheduler] Starting scheduler service...');
    this.intervalId = setInterval(() => this.checkScheduledJobs(), this.checkIntervalMs);
    
    // Run immediately on start
    this.checkScheduledJobs();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Scheduler] Stopped');
    }
  }

  private async checkScheduledJobs() {
    if (this.isRunning) {
      return; // Prevent overlapping checks
    }

    this.isRunning = true;

    try {
      // Find all scheduled jobs that are due
      const dueJobs = await blastRepository.findDueScheduledJobs();

      if (dueJobs.length > 0) {
        console.log(`[Scheduler] Found ${dueJobs.length} due scheduled job(s)`);
      }

      for (const job of dueJobs) {
        await this.processScheduledJob(job);
      }
    } catch (error) {
      console.error('[Scheduler] Error checking scheduled jobs:', error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processScheduledJob(job: any) {
    console.log(`[Scheduler] Processing scheduled job ${job.id} for user ${job.user_id}`);

    try {
      // Check if WhatsApp is connected for this user
      if (!whatsappSessionManager.isReady(job.user_id)) {
        console.log(`[Scheduler] WhatsApp not ready for user ${job.user_id}, skipping job ${job.id}`);
        // Don't fail the job, just skip for now - will retry on next check
        return;
      }

      // Get recipients from database
      const recipients = await blastRepository.getJobRecipients(job.id);
      
      if (recipients.length === 0) {
        console.log(`[Scheduler] No recipients found for job ${job.id}`);
        await blastRepository.updateJobStatus(job.id, 'failed');
        return;
      }

      // Convert to Recipient format
      const recipientList: Recipient[] = recipients.map(r => ({
        phone: r.phone,
        name: r.name || r.phone
      }));

      // Create payload for blast queue
      const payload: CreateBlastPayload = {
        type: job.message_type as MessageType,
        content: job.content || '',
        recipients: recipientList,
        delayMs: job.delay_ms || 3000
      };

      if (job.media_path) {
        payload.mediaPath = job.media_path;
        payload.mediaName = job.media_name;
      }

      // Update status to running
      await blastRepository.updateJobStatus(job.id, 'running');

      // Create in-memory job using existing job ID
      const queueJob = blastQueue.createJob(job.user_id, payload, job.id);
      console.log(`[Scheduler] Created queue job ${queueJob.id} with ${recipientList.length} recipients`);

      // Start the job (don't await - let it run in background)
      blastQueue.startJob(job.user_id, job.id).catch(err => {
        console.error(`[Scheduler] Job ${job.id} failed:`, err.message);
      });
      console.log(`[Scheduler] Started job ${job.id}`);

    } catch (error: any) {
      console.error(`[Scheduler] Failed to process job ${job.id}:`, error.message);
      await blastRepository.updateJobStatus(job.id, 'failed');
    }
  }
}

export const schedulerService = new SchedulerService();
