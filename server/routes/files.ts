import { Router, Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from './auth.js';

const router = Router();

router.use(authMiddleware);

const baseUploadsDir = path.resolve('uploads', 'file-manager');
fs.mkdirSync(baseUploadsDir, { recursive: true });

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function getUserDirectory(userId: string): string {
  const dir = path.join(baseUploadsDir, sanitizeSegment(userId));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function getFileType(fileName: string, mimetype?: string): 'pdf' | 'image' | 'doc' | 'other' {
  const ext = path.extname(fileName).toLowerCase();

  if (mimetype?.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    return 'image';
  }
  if (ext === '.pdf') {
    return 'pdf';
  }
  if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'].includes(ext)) {
    return 'doc';
  }

  return 'other';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userId = (req as any).user?.userId;
    cb(null, getUserDirectory(userId));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${baseName || 'file'}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 16 * 1024 * 1024,
  },
});

router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    const userDir = getUserDirectory(userId);
    const entries = await fs.promises.readdir(userDir, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter(entry => entry.isFile())
        .map(async entry => {
          const absolutePath = path.join(userDir, entry.name);
          const stats = await fs.promises.stat(absolutePath);
          return {
            id: entry.name,
            name: entry.name,
            size: formatBytes(stats.size),
            bytes: stats.size,
            type: getFileType(entry.name),
            date: stats.mtime.toISOString(),
            url: `/uploads/file-manager/${sanitizeSegment(userId)}/${encodeURIComponent(entry.name)}`,
          };
        })
    );

    files.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    res.json({ success: true, count: files.length, files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Failed to load files' });
  }
});

router.post('/upload', upload.array('files'), async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const uploadedFiles = (req.files as Express.Multer.File[]) || [];

  try {
    const files = uploadedFiles.map(file => ({
      id: file.filename,
      name: file.filename,
      size: formatBytes(file.size),
      bytes: file.size,
      type: getFileType(file.originalname, file.mimetype),
      date: new Date().toISOString(),
      url: `/uploads/file-manager/${sanitizeSegment(userId)}/${encodeURIComponent(file.filename)}`,
    }));

    res.json({ success: true, uploaded: files.length, files });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Upload failed' });
  }
});

router.delete('/:fileId', async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    const safeFileId = path.basename(req.params.fileId);
    const userDir = getUserDirectory(userId);
    const targetPath = path.join(userDir, safeFileId);

    if (!fs.existsSync(targetPath)) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    await fs.promises.unlink(targetPath);
    res.json({ success: true, deleted: true });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message || 'Delete failed' });
  }
});

export default router;
