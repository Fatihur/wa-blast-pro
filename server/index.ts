import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { whatsappSessionManager } from './services/whatsappSessionManager.js';
import { blastQueue } from './services/blastQueue.js';
import { schedulerService } from './services/schedulerService.js';
import whatsappRoutes from './routes/whatsapp.js';
import contactsRoutes from './routes/contacts.js';
import blastRoutes from './routes/blast.js';
import authRoutes from './routes/auth.js';
import { ConnectionStatus } from './types.js';
import { testConnection } from './config/database.js';
import { authService } from './services/authService.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/blast', blastRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Socket.io authentication middleware
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

io.on('connection', (socket) => {
  const userId = (socket as any).userId;
  console.log(`Client connected: ${socket.id} (User: ${userId})`);

  // Join user-specific room
  socket.join(`user:${userId}`);

  // Send current status for this user
  socket.emit('whatsapp_status', {
    status: whatsappSessionManager.getStatus(userId),
    qrCode: whatsappSessionManager.getQRCode(userId),
    clientInfo: whatsappSessionManager.getClientInfo(userId)
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id} (User: ${userId})`);
  });
});

// WhatsApp Session Manager events - emit to user-specific rooms
whatsappSessionManager.on('status_change', (userId: string, status: ConnectionStatus) => {
  io.to(`user:${userId}`).emit('whatsapp_status', {
    status,
    qrCode: whatsappSessionManager.getQRCode(userId),
    clientInfo: whatsappSessionManager.getClientInfo(userId)
  });
});

whatsappSessionManager.on('qr', (userId: string, qrCode: string) => {
  io.to(`user:${userId}`).emit('whatsapp_qr', { qrCode });
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
});

// Blast Queue events - emit to user-specific rooms
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
    lastResult: result
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

async function startServer() {
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.error('\n⚠️  Warning: Database not connected. Some features may not work.');
    console.error('   Run: cd server && npm run db:init\n');
  }

  // Start the scheduler service for scheduled blasts
  schedulerService.start();

  httpServer.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log('📅 Scheduler service started (checking every 30 seconds)');
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
