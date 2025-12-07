import { Router, Request, Response } from 'express';
import { whatsappSessionManager } from '../services/whatsappSessionManager.js';
import { authMiddleware } from './auth.js';

const router = Router();

router.use(authMiddleware);

// Get all chats
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const chats = await whatsappSessionManager.getAllChats(userId);
    res.json({
      success: true,
      count: chats.length,
      chats
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get chat by ID
router.get('/:chatId', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const chat = await whatsappSessionManager.getChatById(userId, chatId);
    res.json({
      success: true,
      chat
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Fetch messages from a chat
router.get('/:chatId/messages', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;
    const fromMe = req.query.fromMe === 'true' ? true : req.query.fromMe === 'false' ? false : undefined;
    
    const messages = await whatsappSessionManager.fetchChatMessages(userId, chatId, { limit, fromMe });
    res.json({
      success: true,
      count: messages.length,
      messages
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send message to chat
router.post('/:chatId/send', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const { content, options } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const result = await whatsappSessionManager.sendMessageToChat(userId, chatId, content, options);
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

// Mark chat as seen
router.post('/:chatId/seen', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const result = await whatsappSessionManager.sendSeenToChat(userId, chatId);
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Archive chat
router.post('/:chatId/archive', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    await whatsappSessionManager.archiveChat(userId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Unarchive chat
router.post('/:chatId/unarchive', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    await whatsappSessionManager.unarchiveChat(userId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pin chat
router.post('/:chatId/pin', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const result = await whatsappSessionManager.pinChat(userId, chatId);
    res.json({
      success: true,
      pinned: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Unpin chat
router.post('/:chatId/unpin', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const result = await whatsappSessionManager.unpinChat(userId, chatId);
    res.json({
      success: true,
      pinned: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mute chat
router.post('/:chatId/mute', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const { unmuteDate } = req.body;
    const result = await whatsappSessionManager.muteChat(userId, chatId, unmuteDate ? new Date(unmuteDate) : undefined);
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Unmute chat
router.post('/:chatId/unmute', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const result = await whatsappSessionManager.unmuteChat(userId, chatId);
    res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Mark chat as unread
router.post('/:chatId/mark-unread', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    await whatsappSessionManager.markChatUnread(userId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear chat messages
router.post('/:chatId/clear', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const result = await whatsappSessionManager.clearChatMessages(userId, chatId);
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete chat
router.delete('/:chatId', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const result = await whatsappSessionManager.deleteChat(userId, chatId);
    res.json({
      success: true,
      result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get chat contact
router.get('/:chatId/contact', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const contact = await whatsappSessionManager.getChatContact(userId, chatId);
    res.json({
      success: true,
      contact
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send typing state
router.post('/:chatId/typing', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    await whatsappSessionManager.sendTypingState(userId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Send recording state
router.post('/:chatId/recording', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    await whatsappSessionManager.sendRecordingState(userId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear chat state
router.post('/:chatId/clear-state', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    await whatsappSessionManager.clearChatState(userId, chatId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get pinned messages
router.get('/:chatId/pinned-messages', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const messages = await whatsappSessionManager.getPinnedMessages(userId, chatId);
    res.json({
      success: true,
      messages
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get chat labels
router.get('/:chatId/labels', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const labels = await whatsappSessionManager.getChatLabels(userId, chatId);
    res.json({
      success: true,
      labels
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Change chat labels
router.post('/:chatId/labels', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { chatId } = req.params;
    const { labelIds } = req.body;
    
    if (!Array.isArray(labelIds)) {
      return res.status(400).json({
        success: false,
        error: 'labelIds must be an array'
      });
    }

    await whatsappSessionManager.changeChatLabels(userId, chatId, labelIds);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
