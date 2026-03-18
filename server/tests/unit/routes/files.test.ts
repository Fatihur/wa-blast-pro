import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-blast-files-test-'));

jest.mock('../../../routes/auth', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.user = { userId: 'user-1' };
    next();
  },
}));

describe('files routes', () => {
  let originalCwd: string;

  beforeAll(() => {
    originalCwd = process.cwd();
    process.chdir(tempRoot);
  });

  afterAll(() => {
    process.chdir(originalCwd);
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  beforeEach(() => {
    fs.rmSync(path.join(tempRoot, 'uploads'), { recursive: true, force: true });
    jest.resetModules();
  });

  it('lists uploaded files for the authenticated user', async () => {
    const userDir = path.join(tempRoot, 'uploads', 'file-manager', 'user-1');
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, 'sample.pdf'), 'hello world');

    const filesRoutes = (await import('../../../routes/files')).default;
    const app = express();
    app.use('/files', filesRoutes);

    const response = await request(app).get('/files');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.files[0]).toEqual(
      expect.objectContaining({
        id: 'sample.pdf',
        name: 'sample.pdf',
        type: 'pdf',
      })
    );
  });

  it('deletes a user file', async () => {
    const userDir = path.join(tempRoot, 'uploads', 'file-manager', 'user-1');
    fs.mkdirSync(userDir, { recursive: true });
    fs.writeFileSync(path.join(userDir, 'sample.pdf'), 'hello world');

    const filesRoutes = (await import('../../../routes/files')).default;
    const app = express();
    app.use('/files', filesRoutes);

    const response = await request(app).delete('/files/sample.pdf');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, deleted: true });
    expect(fs.existsSync(path.join(userDir, 'sample.pdf'))).toBe(false);
  });
});
