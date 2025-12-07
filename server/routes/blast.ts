import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { blastQueue } from '../services/blastQueue.js';
import { CreateBlastPayload, MessageType, Recipient } from '../types.js';
import { blastRepository } from '../repositories/blastRepository.js';
import { authMiddleware } from './auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

const uploadsDir = './uploads';
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 16 * 1024 * 1024
  }
});

// ============================================
// SPECIFIC ROUTES (must be before /:id routes)
// ============================================

// Get dashboard stats - MUST be before /:id
router.get('/stats/dashboard', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const stats = await blastRepository.getDashboardStats(userId);
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all jobs from database (history) - MUST be before /:id
router.get('/history', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const jobs = await blastRepository.findAllJobs(userId, limit);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get scheduled jobs - MUST be before /:id
router.get('/scheduled', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const jobs = await blastRepository.findScheduledJobs(userId);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create scheduled blast job - MUST be before /:id
router.post('/schedule', upload.single('media'), async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { type, content, recipients, delayMs, scheduledAt } = req.body;

    if (!scheduledAt) {
      return res.status(400).json({ success: false, error: 'Scheduled time is required' });
    }

    const scheduledDate = new Date(scheduledAt);
    if (scheduledDate <= new Date()) {
      return res.status(400).json({ success: false, error: 'Scheduled time must be in the future' });
    }

    let recipientList: Recipient[];
    if (typeof recipients === 'string') {
      try {
        const parsed = JSON.parse(recipients);
        recipientList = parsed.map((r: string | Recipient) => {
          if (typeof r === 'string') return { phone: r, name: r };
          return r;
        });
      } catch {
        recipientList = recipients.split(',').map((r: string) => ({ phone: r.trim(), name: r.trim() }));
      }
    } else if (Array.isArray(recipients)) {
      recipientList = recipients.map((r: string | Recipient) => {
        if (typeof r === 'string') return { phone: r, name: r };
        return r;
      });
    } else {
      recipientList = [];
    }

    if (!recipientList || recipientList.length === 0) {
      return res.status(400).json({ success: false, error: 'Recipients are required' });
    }

    const dbJob = await blastRepository.createJob({
      user_id: userId,
      message_type: type as MessageType || MessageType.TEXT,
      content: content || '',
      media_path: req.file?.path,
      media_name: req.file?.originalname,
      recipients: recipientList,
      delay_ms: parseInt(delayMs) || 3000,
      scheduled_at: scheduledDate
    });

    res.json({
      success: true,
      job: {
        id: dbJob.id,
        status: dbJob.status,
        scheduled_at: dbJob.scheduled_at,
        total_recipients: dbJob.total_recipients
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all in-memory jobs
router.get('/', (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const jobs = blastQueue.getAllJobs(userId);

    res.json({
      success: true,
      count: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new blast job
router.post('/create', upload.single('media'), async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { type, content, recipients, delayMs, pollData, locationData } = req.body;

    let recipientList: Recipient[];
    if (typeof recipients === 'string') {
      try {
        const parsed = JSON.parse(recipients);
        // Support both old format (string[]) and new format (Recipient[])
        recipientList = parsed.map((r: string | Recipient) => {
          if (typeof r === 'string') {
            return { phone: r, name: r };
          }
          return r;
        });
      } catch {
        // Fallback for comma-separated string
        recipientList = recipients.split(',').map((r: string) => ({ phone: r.trim(), name: r.trim() }));
      }
    } else if (Array.isArray(recipients)) {
      recipientList = recipients.map((r: string | Recipient) => {
        if (typeof r === 'string') {
          return { phone: r, name: r };
        }
        return r;
      });
    } else {
      recipientList = [];
    }

    if (!recipientList || recipientList.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients are required'
      });
    }

    // Parse poll/location data if provided
    let parsedPollData = null;
    let parsedLocationData = null;
    
    if (pollData) {
      parsedPollData = typeof pollData === 'string' ? JSON.parse(pollData) : pollData;
    }
    if (locationData) {
      parsedLocationData = typeof locationData === 'string' ? JSON.parse(locationData) : locationData;
    }

    // Save to database (store as JSON string for DB compatibility)
    const dbJob = await blastRepository.createJob({
      user_id: userId,
      message_type: type as MessageType || MessageType.TEXT,
      content: content || '',
      media_path: req.file?.path,
      media_name: req.file?.originalname,
      recipients: recipientList,
      delay_ms: parseInt(delayMs) || 3000,
      poll_data: parsedPollData,
      location_data: parsedLocationData
    });

    // Also create in-memory job for queue processing
    const payload: CreateBlastPayload = {
      type: type as MessageType || MessageType.TEXT,
      content: content || '',
      recipients: recipientList,
      delayMs: parseInt(delayMs) || 3000
    };

    if (req.file) {
      payload.mediaPath = req.file.path;
      payload.mediaName = req.file.originalname;
    }
    
    if (parsedPollData) {
      payload.pollData = parsedPollData;
    }
    if (parsedLocationData) {
      payload.locationData = parsedLocationData;
    }

    const job = blastQueue.createJob(userId, payload, dbJob.id);

    res.json({
      success: true,
      job: {
        id: job.id,
        status: job.status,
        progress: job.progress,
        createdAt: job.createdAt
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// DYNAMIC ROUTES (must be LAST)
// ============================================

// Start job
router.post('/:id/start', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    blastQueue.startJob(userId, id);
    await blastRepository.updateJobStatus(id, 'running');

    res.json({
      success: true,
      message: 'Blast job started'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pause job
router.post('/:id/pause', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    // Try to pause in memory
    const paused = blastQueue.pauseJob(userId, id);
    
    // Always update database
    await blastRepository.updateJobStatus(id, 'paused');

    res.json({
      success: true,
      message: 'Blast job paused',
      inMemory: paused
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume job
router.post('/:id/resume', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    // Check if job exists in memory
    const existingJob = blastQueue.getJob(userId, id);
    
    if (existingJob) {
      // Resume existing job
      await blastQueue.resumeJob(userId, id);
    } else {
      // Job not in memory - need to reload from database and restart
      const dbJob = await blastRepository.findJobById(id, userId);
      if (!dbJob) {
        return res.status(404).json({ success: false, error: 'Job not found' });
      }
      
      // Get remaining recipients
      const recipients = await blastRepository.getJobRecipients(id);
      const pendingRecipients = recipients
        .filter(r => r.status === 'pending')
        .map(r => ({ phone: r.phone, name: r.name }));
      
      if (pendingRecipients.length === 0) {
        return res.status(400).json({ success: false, error: 'No pending recipients to send' });
      }
      
      // Create new job in memory with remaining recipients
      const payload = {
        type: dbJob.message_type,
        content: dbJob.content || '',
        recipients: pendingRecipients,
        delayMs: dbJob.delay_ms || 3000,
        mediaPath: dbJob.media_path,
        mediaName: dbJob.media_name
      };
      
      blastQueue.createJob(userId, payload, id);
      blastQueue.startJob(userId, id).catch(err => {
        console.error(`[Resume] Failed to start job ${id}:`, err.message);
      });
    }
    
    await blastRepository.updateJobStatus(id, 'running');

    res.json({
      success: true,
      message: 'Blast job resumed'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel scheduled job
router.post('/:id/cancel-schedule', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    const job = await blastRepository.findJobById(id, userId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }
    
    if (job.status !== 'scheduled') {
      return res.status(400).json({ success: false, error: 'Job is not scheduled' });
    }

    await blastRepository.updateJobStatus(id, 'cancelled');

    res.json({
      success: true,
      message: 'Scheduled blast cancelled'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cancel job (running or paused)
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    // Try to cancel in memory (will abort if running)
    const cancelled = blastQueue.cancelJob(userId, id);
    
    // Always update database to cancelled status
    await blastRepository.updateJobStatus(id, 'cancelled');

    res.json({
      success: true,
      message: 'Blast job cancelled',
      inMemory: cancelled
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single job
router.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    // Try in-memory first
    let job = blastQueue.getJob(userId, id);
    
    // Fallback to database
    if (!job) {
      const dbJob = await blastRepository.findJobById(id, userId);
      if (dbJob) {
        return res.json({
          success: true,
          job: {
            id: dbJob.id,
            status: dbJob.status,
            progress: {
              total: dbJob.total_recipients,
              sent: dbJob.sent_count,
              failed: dbJob.failed_count,
              current: dbJob.current_index
            },
            createdAt: dbJob.created_at,
            startedAt: dbJob.started_at,
            completedAt: dbJob.completed_at
          }
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'Job not found'
      });
    }

    res.json({
      success: true,
      job
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete job
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { id } = req.params;
    
    // Delete from memory
    blastQueue.deleteJob(userId, id);
    
    // Delete from database
    await blastRepository.deleteJob(id, userId);

    res.json({
      success: true,
      message: 'Job deleted'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
