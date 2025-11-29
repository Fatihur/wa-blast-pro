import { Router, Request, Response, NextFunction } from 'express';
import { authService } from '../services/authService.js';

const router = Router();

// Middleware to verify JWT token
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'No token provided' });
  }

  const token = authHeader.substring(7);
  const result = await authService.verifyToken(token);
  
  if (!result.valid) {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }

  (req as any).user = result.payload;
  next();
};

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password } = req.body;

    console.log('Register attempt:', { name, email, passwordLength: password?.length });

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, error: 'Name, email and password are required' });
    }

    const result = await authService.register(name, email, password);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Register error:', error.message, error.stack);
    res.status(500).json({ success: false, error: error.message || 'Registration failed' });
  }
});

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const result = await authService.login(email, password, rememberMe);
    
    if (!result.success) {
      return res.status(401).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token,
      rememberToken: result.rememberToken
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Login with remember token
router.post('/login-remember', async (req: Request, res: Response) => {
  try {
    const { rememberToken } = req.body;

    if (!rememberToken) {
      return res.status(400).json({ success: false, error: 'Remember token is required' });
    }

    const result = await authService.loginWithRememberToken(rememberToken);
    
    if (!result.success) {
      return res.status(401).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token,
      rememberToken: result.rememberToken
    });
  } catch (error: any) {
    console.error('Remember login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

// Logout
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    await authService.logout(userId);
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

// Forgot password - request reset
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const result = await authService.forgotPassword(email);
    
    // Always return success to prevent email enumeration
    res.json({
      success: true,
      message: result.message,
      // Include resetToken only in development
      ...(process.env.NODE_ENV !== 'production' && { resetToken: result.resetToken })
    });
  } catch (error: any) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, error: 'Request failed' });
  }
});

// Reset password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: 'Token and new password are required' });
    }

    const result = await authService.resetPassword(token, newPassword);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: result.message,
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, error: 'Password reset failed' });
  }
});

// Verify token & get current user
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const user = await authService.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, user });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const result = await authService.updateProfile(userId, { name });
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: result.user
    });
  } catch (error: any) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// Change password
router.post('/change-password', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }

    const result = await authService.changePassword(userId, currentPassword, newPassword);
    
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.message });
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error: any) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

export default router;
