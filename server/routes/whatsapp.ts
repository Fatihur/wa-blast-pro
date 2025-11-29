import { Router, Request, Response } from 'express';
import { whatsappSessionManager } from '../services/whatsappSessionManager.js';
import { MessageType } from '../types.js';
import { authMiddleware } from './auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

router.get('/status', (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  res.json({
    status: whatsappSessionManager.getStatus(userId),
    qrCode: whatsappSessionManager.getQRCode(userId),
    pairingCode: whatsappSessionManager.getPairingCode(userId),
    clientInfo: whatsappSessionManager.getClientInfo(userId)
  });
});

// Connect with QR code (default)
router.post('/connect', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    await whatsappSessionManager.initialize(userId, 'qr');
    res.json({ 
      success: true, 
      message: 'WhatsApp client initializing...',
      status: whatsappSessionManager.getStatus(userId)
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Connect with pairing code (phone number)
router.post('/connect-pairing', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const pairingCode = await whatsappSessionManager.initialize(userId, 'pairing', phoneNumber);
    
    res.json({ 
      success: true, 
      message: 'Pairing code generated',
      pairingCode,
      status: whatsappSessionManager.getStatus(userId)
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/disconnect', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    await whatsappSessionManager.logout(userId);
    res.json({ 
      success: true, 
      message: 'WhatsApp disconnected' 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.post('/send', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { phone, type, content, mediaUrl } = req.body;

    if (!phone || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone and content are required' 
      });
    }

    let result;

    if (type === MessageType.TEXT || !type) {
      result = await whatsappSessionManager.sendTextMessage(userId, phone, content);
    } else if (mediaUrl) {
      result = await whatsappSessionManager.sendMediaFromUrl(userId, phone, mediaUrl, content, type);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Media URL required for non-text messages' 
      });
    }

    res.json({ 
      success: true, 
      messageId: result.id?._serialized,
      timestamp: result.timestamp
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

router.get('/check-number/:phone', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { phone } = req.params;
    const isRegistered = await whatsappSessionManager.checkNumberRegistered(userId, phone);
    res.json({ 
      phone, 
      isRegistered 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send Poll
router.post('/send-poll', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { phone, question, options, allowMultiple } = req.body;

    if (!phone || !question || !options || options.length < 2) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone, question, and at least 2 options are required' 
      });
    }

    const result = await whatsappSessionManager.sendPoll(userId, phone, {
      question,
      options,
      allowMultiple: allowMultiple || false
    });

    res.json({ 
      success: true, 
      messageId: result.id?._serialized,
      timestamp: result.timestamp
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send Location
router.post('/send-location', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { phone, latitude, longitude, description } = req.body;

    if (!phone || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ 
        success: false, 
        error: 'Phone, latitude, and longitude are required' 
      });
    }

    const result = await whatsappSessionManager.sendLocation(userId, phone, {
      latitude,
      longitude,
      description: description || ''
    });

    res.json({ 
      success: true, 
      messageId: result.id?._serialized,
      timestamp: result.timestamp
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get WhatsApp Groups
router.get('/groups', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const groups = await whatsappSessionManager.getWhatsAppGroups(userId);
    res.json({ 
      success: true, 
      groups 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get Group Participants
router.get('/groups/:groupId/participants', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { groupId } = req.params;
    const participants = await whatsappSessionManager.getGroupParticipants(userId, groupId);
    res.json({ 
      success: true, 
      participants 
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Send to Group
router.post('/send-to-group', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { groupId, type, content, mediaUrl, pollData, locationData } = req.body;

    if (!groupId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Group ID is required' 
      });
    }

    let result;

    if (type === MessageType.POLL && pollData) {
      result = await whatsappSessionManager.sendPollToGroup(userId, groupId, pollData);
    } else if (type === MessageType.TEXT || !type) {
      result = await whatsappSessionManager.sendToGroup(userId, groupId, content);
    } else if (mediaUrl) {
      result = await whatsappSessionManager.sendMediaToGroup(userId, groupId, mediaUrl, content);
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid message type or missing data' 
      });
    }

    res.json({ 
      success: true, 
      messageId: result.id?._serialized,
      timestamp: result.timestamp
    });
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

export default router;
