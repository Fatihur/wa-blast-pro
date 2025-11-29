import bcryptPkg from 'bcryptjs';
import jwtPkg from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { authRepository, User } from '../repositories/authRepository.js';

const bcrypt = bcryptPkg;
const jwt = jwtPkg;

const JWT_SECRET = process.env.JWT_SECRET || 'wa-blast-pro-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';
const REMEMBER_TOKEN_EXPIRES_IN = '30d';

export interface AuthResult {
  success: boolean;
  message: string;
  user?: Omit<User, 'password'>;
  token?: string;
  rememberToken?: string;
}

export interface TokenPayload {
  userId: string;
  email: string;
}

export const authService = {
  async register(name: string, email: string, password: string): Promise<AuthResult> {
    const existingUser = await authRepository.findUserByEmail(email);
    if (existingUser) {
      return { success: false, message: 'Email already registered' };
    }

    if (password.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' };
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await authRepository.createUser(name, email, hashedPassword);

    const token = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return {
      success: true,
      message: 'Registration successful',
      user: userWithoutPassword,
      token
    };
  },

  async login(email: string, password: string, rememberMe: boolean = false): Promise<AuthResult> {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      return { success: false, message: 'Invalid email or password' };
    }

    if (!user.is_active) {
      return { success: false, message: 'Account is deactivated' };
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid email or password' };
    }

    const token = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    let rememberToken: string | undefined;
    if (rememberMe) {
      rememberToken = this.generateRememberToken();
      await authRepository.updateRememberToken(user.id, rememberToken);
    }

    return {
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
      rememberToken
    };
  },

  async loginWithRememberToken(rememberToken: string): Promise<AuthResult> {
    const user = await authRepository.findUserByRememberToken(rememberToken);
    if (!user || !user.is_active) {
      return { success: false, message: 'Invalid or expired remember token' };
    }

    const token = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    const newRememberToken = this.generateRememberToken();
    await authRepository.updateRememberToken(user.id, newRememberToken);

    return {
      success: true,
      message: 'Login successful',
      user: userWithoutPassword,
      token,
      rememberToken: newRememberToken
    };
  },

  async logout(userId: string): Promise<void> {
    await authRepository.updateRememberToken(userId, null);
  },

  async forgotPassword(email: string): Promise<{ success: boolean; message: string; resetToken?: string }> {
    const user = await authRepository.findUserByEmail(email);
    if (!user) {
      return { success: true, message: 'If email exists, reset instructions will be sent' };
    }

    const resetToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await authRepository.createPasswordReset(user.id, resetToken, expiresAt);

    // In production, send email here
    // For now, return the token (for demo/testing purposes)
    return {
      success: true,
      message: 'Password reset instructions sent to your email',
      resetToken // Remove this in production!
    };
  },

  async resetPassword(token: string, newPassword: string): Promise<AuthResult> {
    const resetRecord = await authRepository.findValidPasswordReset(token);
    if (!resetRecord) {
      return { success: false, message: 'Invalid or expired reset token' };
    }

    if (newPassword.length < 6) {
      return { success: false, message: 'Password must be at least 6 characters' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePassword(resetRecord.user_id, hashedPassword);
    await authRepository.markPasswordResetUsed(resetRecord.id);

    const user = await authRepository.findUserById(resetRecord.user_id);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const jwtToken = this.generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return {
      success: true,
      message: 'Password reset successful',
      user: userWithoutPassword,
      token: jwtToken
    };
  },

  async verifyToken(token: string): Promise<{ valid: boolean; payload?: TokenPayload }> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      const user = await authRepository.findUserById(payload.userId);
      if (!user || !user.is_active) {
        return { valid: false };
      }
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  },

  async getUser(userId: string): Promise<Omit<User, 'password'> | null> {
    const user = await authRepository.findUserById(userId);
    if (!user) return null;
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  async updateProfile(userId: string, data: { name: string }): Promise<{ success: boolean; message: string; user?: Omit<User, 'password'> }> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    await authRepository.updateUser(userId, { name: data.name });
    const updatedUser = await authRepository.findUserById(userId);
    
    if (!updatedUser) {
      return { success: false, message: 'Failed to update profile' };
    }

    const { password: _, ...userWithoutPassword } = updatedUser;
    return { success: true, message: 'Profile updated', user: userWithoutPassword };
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return { success: false, message: 'Current password is incorrect' };
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await authRepository.updatePassword(userId, hashedPassword);

    return { success: true, message: 'Password changed successfully' };
  },

  generateToken(user: User): string {
    return jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  },

  generateRememberToken(): string {
    return randomBytes(64).toString('hex');
  }
};
