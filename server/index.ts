import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import compression from 'compression';
import morgan from 'morgan';
import { whatsappSessionManager } from './services/whatsappSessionManager.js';
import { blastQueue } from './services/blastQueue.js';
import { schedulerService } from './services/schedulerService.js';
import whatsappRoutes from './routes/whatsapp.js';
import contactsRoutes from './routes/contacts.js';
import blastRoutes from './routes/blast.js';
import authRoutes from './routes/auth.js';
import settingsRoutes from './routes/settings.js';
import headerRoutes, { saveInboxMessage, createNotification } from './routes/header.js';
import chatRoutes from './routes/chat.js';
import filesRoutes from './routes/files.js';
import { ConnectionStatus } from './types.js';
import { testConnection } from './config/database.js';
import { authService } from './services/authService.js';
import { logger, stream } from './config/logger.js';
import { helmetConfig, corsConfig, enforceHTTPS, sanitizeBody, requestId, securityLogger } from './middleware/security.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'CHANGE_THIS_TO_SECURE_RANDOM_64_BYTE_STRING_IN_PRODUCTION') {
  logger.error('CRITICAL: JWT_SECRET is not set or using default value!');
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const app = express();
const httpServer = createServer(app);

const allowedOrigins =
  process.env.ALLOWED_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ||
  process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()).filter(Boolean) ||
  ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('trust proxy', 1);

if (process.env.HELMET_ENABLED !== 'false') {
  app.use(helmetConfig);
}
app.use(corsConfig());
app.use(enforceHTTPS);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeBody);
app.use(morgan('combined', { stream }));
app.use(requestId);
app.use(securityLogger);
app.use('/api/', apiLimiter);
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/blast', blastRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/header', headerRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/files', filesRoutes);

app.get('/api/health', async (_req, res) => {
  try {
    const dbHealthy = await testConnection();
    res.status(dbHealthy ? 200 : 503).json({
      status: dbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        whatsapp: 'healthy',
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB',
        },
      },
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
    });
  }
});

app.use(notFoundHandler);
app.use(errorHandler);

io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  const result = await authService.verifyToken(token);
  if (!result.valid || !result.payload) {
    return next(new Error('Invalid token'));
  }

  (socket as any).userId = result.payload.userId;
  next();
});

io.on('connection', socket => {
  const userId = (socket as any).userId;
  socket.join(`user:${userId}`);

  socket.emit('whatsapp_status', {
    status: whatsappSessionManager.getStatus(userId),
    qrCode: whatsappSessionManager.getQRCode(userId),
    pairingCode: whatsappSessionManager.getPairingCode(userId),
    clientInfo: whatsappSessionManager.getClientInfo(userId),
  });
});

whatsappSessionManager.on('status_change', (userId: string, status: ConnectionStatus) => {
  io.to(`user:${userId}`).emit('whatsapp_status', {
    status,
    qrCode: whatsappSessionManager.getQRCode(userId),
    pairingCode: whatsappSessionManager.getPairingCode(userId),
    clientInfo: whatsappSessionManager.getClientInfo(userId),
  });
});

whatsappSessionManager.on('qr', (userId: string, qrCode: string) => {
  io.to(`user:${userId}`).emit('whatsapp_qr', { qrCode });
});

whatsappSessionManager.on('pairing_code', (userId: string, pairingCode: string) => {
  io.to(`user:${userId}`).emit('whatsapp_pairing_code', { pairingCode });
});

whatsappSessionManager.on('ready', (userId: string, clientInfo: any) => {
  io.to(`user:${userId}`).emit('whatsapp_ready', { clientInfo });
});

whatsappSessionManager.on('authenticated', (userId: string) => {
  io.to(`user:${userId}`).emit('whatsapp_authenticated');
});

whatsappSessionManager.on('auth_failure', (userId: string, msg: string) => {
  io.to(`user:${userId}`).emit('whatsapp_auth_failure', { message: msg });
});

whatsappSessionManager.on('disconnected', (userId: string, reason: string) => {
  io.to(`user:${userId}`).emit('whatsapp_disconnected', { reason });

  createNotification(
    userId,
    'session_disconnected',
    'WhatsApp Terputus',
    `Sesi WhatsApp terputus: ${reason}`,
    { reason }
  ).catch(() => {});
});

whatsappSessionManager.on('message', async (userId: string, message: any) => {
  try {
    if (!message.fromMe) {
      const fromPhone = message.from.replace('@c.us', '');
      const fromName = message._data?.notifyName || message.notifyName || fromPhone;

      let messageType = 'TEXT';
      let content = message.body || '';
      let mediaUrl: string | undefined;

      if (message.hasMedia) {
        try {
          const media = await message.downloadMedia();
          if (media) {
            messageType = message.type?.toUpperCase() || 'OTHER';
            if (!content) content = `[${messageType}]`;
          }
        } catch {
          messageType = message.type?.toUpperCase() || 'OTHER';
          if (!content) content = `[${messageType}]`;
        }
      }

      await saveInboxMessage(userId, fromPhone, fromName, messageType, content, mediaUrl);

      io.to(`user:${userId}`).emit('new_inbox_message', {
        from_phone: fromPhone,
        from_name: fromName,
        content,
        message_type: messageType,
      });
    }
  } catch (error) {
    console.error(`[${userId}] Inbox error:`, (error as Error).message?.substring(0, 50));
  }
});

blastQueue.on('job_created', (userId: string, job) => {
  io.to(`user:${userId}`).emit('blast_job_created', job);
});

blastQueue.on('job_started', (userId: string, job) => {
  io.to(`user:${userId}`).emit('blast_job_started', job);
});

blastQueue.on('message_sent', (userId: string, job, result) => {
  io.to(`user:${userId}`).emit('blast_progress', {
    jobId: job.id,
    progress: job.progress,
    lastResult: result,
  });
});

blastQueue.on('job_completed', (userId: string, job) => {
  io.to(`user:${userId}`).emit('blast_job_completed', job);
});

blastQueue.on('job_paused', (userId: string, job) => {
  io.to(`user:${userId}`).emit('blast_job_paused', job);
});

blastQueue.on('job_failed', (userId: string, job, error) => {
  io.to(`user:${userId}`).emit('blast_job_failed', { job, error: error.message });
});

blastQueue.on('job_cancelled', (userId: string, job) => {
  io.to(`user:${userId}`).emit('blast_job_cancelled', job);
});

const PORT = process.env.PORT || 3001;
let schedulerRetryInterval: NodeJS.Timeout | null = null;

async function ensureSchedulerStarted() {
  const dbConnected = await testConnection();

  if (dbConnected) {
    schedulerService.start();
    if (schedulerRetryInterval) {
      clearInterval(schedulerRetryInterval);
      schedulerRetryInterval = null;
    }
    return true;
  }

  if (!schedulerRetryInterval) {
    schedulerRetryInterval = setInterval(async () => {
      const connected = await testConnection();
      if (connected) {
        console.log('[Scheduler] Database connection restored. Starting scheduler service...');
        schedulerService.start();
        if (schedulerRetryInterval) {
          clearInterval(schedulerRetryInterval);
          schedulerRetryInterval = null;
        }
      }
    }, 30000);
  }

  return false;
}

async function startServer() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('\n[Startup] Database is not ready. Some features will stay unavailable until MySQL and the schema are ready.');
    console.error('          Run: cd server && npm run db:init\n');
  }

  await ensureSchedulerStarted();

  httpServer.listen(PORT, () => {
    console.log(`\n[Startup] Server running on http://localhost:${PORT}`);
    console.log(
      dbConnected
        ? '[Startup] Scheduler service started (checking every 30 seconds)'
        : '[Startup] Scheduler is waiting for a valid database connection'
    );
    console.log('\nEndpoints:');
    console.log('  - GET  /api/health');
    console.log('  - POST /api/auth/register');
    console.log('  - POST /api/auth/login');
    console.log('  - POST /api/whatsapp/connect');
    console.log('  - POST /api/whatsapp/disconnect');
    console.log('  - GET  /api/whatsapp/status');
    console.log('  - GET  /api/contacts');
    console.log('  - POST /api/blast/create');
    console.log('  - POST /api/blast/:id/start');
    console.log('  - POST /api/blast/schedule');
    console.log('  - GET  /api/blast/scheduled');
    console.log('  - GET  /api/blast/stats/dashboard');
    console.log('  - GET  /api/blast/history');
  });
}

startServer();
