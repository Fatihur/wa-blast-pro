import express from 'express';
import request from 'supertest';

const mockWhatsappSessionManager = {
  getAllContacts: jest.fn(),
  checkNumberRegistered: jest.fn(),
};

const mockContactRepository = {
  findPaginated: jest.fn(),
  findAll: jest.fn(),
  create: jest.fn(),
  createMany: jest.fn(),
  deleteMany: jest.fn(),
};

const mockGroupRepository = {
  findAll: jest.fn(),
  belongsToUser: jest.fn(),
  addContacts: jest.fn(),
  removeContact: jest.fn(),
};

jest.mock('../../../services/whatsappSessionManager', () => ({
  whatsappSessionManager: mockWhatsappSessionManager,
}));

jest.mock('../../../repositories/contactRepository', () => ({
  contactRepository: mockContactRepository,
}));

jest.mock('../../../repositories/groupRepository', () => ({
  groupRepository: mockGroupRepository,
}));

jest.mock('../../../routes/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

import contactsRoutes from '../../../routes/contacts';

describe('contacts routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/contacts', contactsRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns paginated contacts when requested', async () => {
    mockContactRepository.findPaginated.mockResolvedValue({
      contacts: [{ id: 'c1', name: 'Alice', phone: '+621', tags: [] }],
      total: 1,
      page: 2,
      limit: 20,
      totalPages: 1,
    });

    const response = await request(app).get('/contacts?paginated=true&page=2&limit=20&search=ali');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockContactRepository.findPaginated).toHaveBeenCalledWith('user-1', 2, 20, 'ali');
  });

  it('rejects add-to-group when group is outside the authenticated user scope', async () => {
    mockGroupRepository.belongsToUser.mockResolvedValue(false);

    const response = await request(app)
      .post('/contacts/groups/group-1/contacts')
      .send({ contactIds: ['c1'] });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      error: 'Group not found',
    });
  });

  it('validates phone lists via whatsapp session manager', async () => {
    mockWhatsappSessionManager.checkNumberRegistered
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const response = await request(app)
      .post('/contacts/validate')
      .send({ phones: ['+621', '+622'] });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.validCount).toBe(1);
    expect(response.body.invalidCount).toBe(1);
  });

  it('returns WhatsApp contacts for sync', async () => {
    mockWhatsappSessionManager.getAllContacts.mockResolvedValue([
      { id: '62812@c.us', number: '62812', isGroup: false },
      { id: '120363@g.us', number: '', isGroup: true },
    ]);

    const response = await request(app).get('/contacts/whatsapp');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.contacts).toEqual([
      { id: '62812@c.us', number: '62812', isGroup: false },
    ]);
  });
});
