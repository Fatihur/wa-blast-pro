import { authService } from '../../../services/authService';

describe('AuthService', () => {
  describe('hashPassword', () => {
    it('should hash password correctly', async () => {
      const password = 'Test123!@#';
      const hashed = await authService.hashPassword(password);
      
      expect(hashed).toBeDefined();
      expect(hashed).not.toBe(password);
      expect(hashed.length).toBeGreaterThan(50);
    });

    it('should produce different hashes for same password', async () => {
      const password = 'Test123!@#';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyPassword', () => {
    it('should verify correct password', async () => {
      const password = 'Test123!@#';
      const hashed = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword(password, hashed);
      
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'Test123!@#';
      const wrongPassword = 'Wrong123!@#';
      const hashed = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword(wrongPassword, hashed);
      
      expect(isValid).toBe(false);
    });

    it('should reject empty password', async () => {
      const password = 'Test123!@#';
      const hashed = await authService.hashPassword(password);
      const isValid = await authService.verifyPassword('', hashed);
      
      expect(isValid).toBe(false);
    });
  });

  describe('generateToken', () => {
    it('should generate valid JWT token', () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = authService.generateToken(payload);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify valid token', async () => {
      const payload = { userId: '123', email: 'test@example.com' };
      const token = authService.generateToken(payload);
      const result = await authService.verifyToken(token);
      
      expect(result.valid).toBe(true);
      expect(result.payload).toBeDefined();
      expect(result.payload?.userId).toBe(payload.userId);
    });

    it('should reject invalid token', async () => {
      const result = await authService.verifyToken('invalid.token.here');
      
      expect(result.valid).toBe(false);
      expect(result.payload).toBeNull();
    });

    it('should reject empty token', async () => {
      const result = await authService.verifyToken('');
      
      expect(result.valid).toBe(false);
    });
  });
});
