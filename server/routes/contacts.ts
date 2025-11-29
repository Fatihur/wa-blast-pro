import { Router, Request, Response } from 'express';
import { whatsappSessionManager } from '../services/whatsappSessionManager.js';
import { contactRepository } from '../repositories/contactRepository.js';
import { groupRepository } from '../repositories/groupRepository.js';
import { authMiddleware } from './auth.js';

const router = Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// ============================================
// SPECIFIC ROUTES (must be before /:id routes)
// ============================================

// Get all contacts from database
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const contacts = await contactRepository.findAll(userId);
    
    res.json({
      success: true,
      count: contacts.length,
      contacts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get contacts from WhatsApp (for syncing)
router.get('/whatsapp', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const contacts = await whatsappSessionManager.getContacts(userId);
    const filteredContacts = contacts.filter(c => !c.isGroup && c.phone);
    
    res.json({
      success: true,
      count: filteredContacts.length,
      contacts: filteredContacts
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search contacts
router.get('/search', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ success: false, error: 'Search query required' });
    }
    
    const contacts = await contactRepository.search(q, userId);
    res.json({ success: true, count: contacts.length, contacts });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get chats from WhatsApp
router.get('/chats', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const chats = await whatsappSessionManager.getChats(userId);
    
    const chatList = chats.map((chat: any) => ({
      id: chat.id._serialized,
      name: chat.name,
      isGroup: chat.isGroup,
      unreadCount: chat.unreadCount,
      timestamp: chat.timestamp,
      lastMessage: chat.lastMessage?.body?.substring(0, 50)
    }));
    
    res.json({
      success: true,
      count: chatList.length,
      chats: chatList
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// GROUP ROUTES (must be before /:id routes)
// ============================================

// Get all groups from database
router.get('/groups', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const groups = await groupRepository.findAll(userId);
    
    res.json({
      success: true,
      count: groups.length,
      groups
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get WhatsApp groups (for reference)
router.get('/groups/whatsapp', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const contacts = await whatsappSessionManager.getContacts(userId);
    const groups = contacts.filter(c => c.isGroup);
    
    res.json({
      success: true,
      count: groups.length,
      groups
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create group
router.post('/groups', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { name, description, contactIds } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Group name is required' });
    }
    
    const group = await groupRepository.create(userId, { name, description });
    
    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      await groupRepository.addContacts(group.id, contactIds);
      group.contactIds = contactIds;
    }
    
    res.json({ success: true, group });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single group
router.get('/groups/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const group = await groupRepository.findById(req.params.id, userId);
    if (!group) {
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    res.json({ success: true, group });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update group
router.put('/groups/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { name, description } = req.body;
    const updated = await groupRepository.update(req.params.id, userId, { name, description });
    res.json({ success: updated, message: updated ? 'Group updated' : 'Group not found' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete group
router.delete('/groups/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const deleted = await groupRepository.delete(req.params.id, userId);
    res.json({ success: deleted, message: deleted ? 'Group deleted' : 'Group not found' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add contacts to group
router.post('/groups/:id/contacts', async (req: Request, res: Response) => {
  try {
    const { contactIds } = req.body;
    if (!Array.isArray(contactIds)) {
      return res.status(400).json({ success: false, error: 'contactIds array required' });
    }
    
    const added = await groupRepository.addContacts(req.params.id, contactIds);
    res.json({ success: true, added });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Remove contact from group
router.delete('/groups/:groupId/contacts/:contactId', async (req: Request, res: Response) => {
  try {
    const { groupId, contactId } = req.params;
    const removed = await groupRepository.removeContact(groupId, contactId);
    res.json({ success: removed });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// OTHER SPECIFIC POST ROUTES
// ============================================

// Create contact
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { name, phone, tags } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }
    
    const contact = await contactRepository.create(userId, { name, phone, tags: tags || [] });
    res.json({ success: true, contact });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Import multiple contacts
router.post('/import', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { contacts } = req.body;
    if (!Array.isArray(contacts)) {
      return res.status(400).json({ success: false, error: 'Contacts array required' });
    }
    
    const imported = await contactRepository.createMany(userId, contacts);
    res.json({ success: true, imported });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete multiple contacts
router.post('/delete-many', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ success: false, error: 'IDs array required' });
    }
    
    const deleted = await contactRepository.deleteMany(ids, userId);
    res.json({ success: true, deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Validate phone numbers
router.post('/validate', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { phones } = req.body;
    
    if (!Array.isArray(phones)) {
      return res.status(400).json({
        success: false,
        error: 'Phones must be an array'
      });
    }

    const results = await Promise.all(
      phones.map(async (phone: string) => {
        try {
          const isRegistered = await whatsappSessionManager.checkNumberRegistered(userId, phone);
          return { phone, isRegistered, error: null };
        } catch (error: any) {
          return { phone, isRegistered: false, error: error.message };
        }
      })
    );

    const valid = results.filter(r => r.isRegistered);
    const invalid = results.filter(r => !r.isRegistered);

    res.json({
      success: true,
      total: phones.length,
      validCount: valid.length,
      invalidCount: invalid.length,
      results
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

// Get single contact
router.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const contact = await contactRepository.findById(req.params.id, userId);
    if (!contact) {
      return res.status(404).json({ success: false, error: 'Contact not found' });
    }
    res.json({ success: true, contact });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update contact
router.put('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const updated = await contactRepository.update(req.params.id, userId, req.body);
    res.json({ success: updated, message: updated ? 'Contact updated' : 'Contact not found' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete contact
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const deleted = await contactRepository.delete(req.params.id, userId);
    res.json({ success: deleted, message: deleted ? 'Contact deleted' : 'Contact not found' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
