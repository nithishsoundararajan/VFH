/**
 * Simple authentication system for standalone deployment
 * Provides basic user management without external dependencies
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import type { SQLiteAdapter } from '../database/sqlite-adapter';
import type { StandaloneConfig } from '../config/standalone';

export interface User {
  id: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthResult {
  user: User;
  tokens: AuthTokens;
  session: Session;
}

export class SimpleAuthAdapter {
  private db: SQLiteAdapter;
  private config: StandaloneConfig['auth'];

  constructor(db: SQLiteAdapter, config: StandaloneConfig['auth']) {
    this.db = db;
    this.config = config;

    if (!config.secret || config.secret === 'change-me-in-production') {
      throw new Error('AUTH_SECRET must be set to a secure value');
    }
  }

  // Password utilities
  private async hashPassword(password: string): Promise<string> {
    const rounds = this.config.options?.bcryptRounds || 12;
    return bcrypt.hash(password, rounds);
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  // JWT utilities
  private generateAccessToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'access' },
      this.config.secret,
      { expiresIn: '1h' }
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId, type: 'refresh' },
      this.config.secret,
      { expiresIn: '7d' }
    );
  }

  private verifyToken(token: string): { userId: string; type: string } | null {
    try {
      const payload = jwt.verify(token, this.config.secret) as any;
      return { userId: payload.userId, type: payload.type };
    } catch {
      return null;
    }
  }

  // Session management
  private async createSession(userId: string): Promise<Session> {
    const sessionId = uuidv4();
    const expiresAt = new Date();
    const sessionTimeout = this.config.options?.sessionTimeout || 24 * 60 * 60 * 1000; // 24 hours
    expiresAt.setTime(expiresAt.getTime() + sessionTimeout);

    this.db.insert('sessions', {
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    });

    return {
      id: sessionId,
      userId,
      expiresAt,
      createdAt: new Date(),
    };
  }

  private async getSession(sessionId: string): Promise<Session | null> {
    const row = this.db.queryOne(
      'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")',
      [sessionId]
    );

    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
    };
  }

  private async deleteSession(sessionId: string): Promise<void> {
    this.db.delete('sessions', { id: sessionId });
  }

  private async cleanupExpiredSessions(): Promise<void> {
    this.db.query('DELETE FROM sessions WHERE expires_at <= datetime("now")');
  }

  // User management
  private mapUserRow(row: any): User {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name,
      avatarUrl: row.avatar_url,
      emailVerified: Boolean(row.email_verified),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  public async getUserById(userId: string): Promise<User | null> {
    const row = this.db.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    return row ? this.mapUserRow(row) : null;
  }

  public async getUserByEmail(email: string): Promise<User | null> {
    const row = this.db.queryOne('SELECT * FROM users WHERE email = ?', [email]);
    return row ? this.mapUserRow(row) : null;
  }

  public async createUser(data: RegisterData): Promise<User> {
    // Check if user already exists
    const existingUser = await this.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      throw new Error('Invalid email format');
    }

    // Validate password strength
    if (data.password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const userId = uuidv4();
    const passwordHash = await this.hashPassword(data.password);

    this.db.insert('users', {
      id: userId,
      email: data.email,
      password_hash: passwordHash,
      full_name: data.fullName || null,
      email_verified: false,
    });

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to create user');
    }

    return user;
  }

  public async updateUser(userId: string, updates: Partial<RegisterData & { emailVerified: boolean }>): Promise<User> {
    const updateData: any = {};

    if (updates.email) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(updates.email)) {
        throw new Error('Invalid email format');
      }

      // Check if email is already taken
      const existingUser = await this.getUserByEmail(updates.email);
      if (existingUser && existingUser.id !== userId) {
        throw new Error('Email is already taken');
      }

      updateData.email = updates.email;
    }

    if (updates.password) {
      if (updates.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
      }
      updateData.password_hash = await this.hashPassword(updates.password);
    }

    if (updates.fullName !== undefined) {
      updateData.full_name = updates.fullName;
    }

    if (updates.emailVerified !== undefined) {
      updateData.email_verified = updates.emailVerified;
    }

    if (Object.keys(updateData).length === 0) {
      throw new Error('No valid updates provided');
    }

    const updated = this.db.update('users', updateData, { id: userId });
    if (updated === 0) {
      throw new Error('User not found');
    }

    const user = await this.getUserById(userId);
    if (!user) {
      throw new Error('Failed to update user');
    }

    return user;
  }

  public async deleteUser(userId: string): Promise<void> {
    const deleted = this.db.delete('users', { id: userId });
    if (deleted === 0) {
      throw new Error('User not found');
    }
  }

  // Authentication methods
  public async register(data: RegisterData): Promise<AuthResult> {
    const user = await this.createUser(data);
    const session = await this.createSession(user.id);
    
    const tokens: AuthTokens = {
      accessToken: this.generateAccessToken(user.id),
      refreshToken: this.generateRefreshToken(user.id),
      expiresIn: 3600, // 1 hour
    };

    return { user, tokens, session };
  }

  public async login(credentials: LoginCredentials): Promise<AuthResult> {
    const user = await this.getUserByEmail(credentials.email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Get password hash
    const row = this.db.queryOne('SELECT password_hash FROM users WHERE id = ?', [user.id]);
    if (!row) {
      throw new Error('Invalid email or password');
    }

    const isValidPassword = await this.verifyPassword(credentials.password, row.password_hash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    const session = await this.createSession(user.id);
    
    const tokens: AuthTokens = {
      accessToken: this.generateAccessToken(user.id),
      refreshToken: this.generateRefreshToken(user.id),
      expiresIn: 3600, // 1 hour
    };

    return { user, tokens, session };
  }

  public async logout(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }

  public async logoutAll(userId: string): Promise<void> {
    this.db.delete('sessions', { user_id: userId });
  }

  public async refreshToken(refreshToken: string): Promise<AuthTokens> {
    const payload = this.verifyToken(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    const user = await this.getUserById(payload.userId);
    if (!user) {
      throw new Error('User not found');
    }

    const tokens: AuthTokens = {
      accessToken: this.generateAccessToken(user.id),
      refreshToken: this.generateRefreshToken(user.id),
      expiresIn: 3600, // 1 hour
    };

    return tokens;
  }

  public async verifyAccessToken(accessToken: string): Promise<User | null> {
    const payload = this.verifyToken(accessToken);
    if (!payload || payload.type !== 'access') {
      return null;
    }

    return this.getUserById(payload.userId);
  }

  public async verifySession(sessionId: string): Promise<User | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    return this.getUserById(session.userId);
  }

  // Password reset (simplified - in production, you'd want email verification)
  public async resetPassword(email: string, newPassword: string): Promise<void> {
    const user = await this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }

    const passwordHash = await this.hashPassword(newPassword);
    this.db.update('users', { password_hash: passwordHash }, { id: user.id });

    // Invalidate all sessions for this user
    await this.logoutAll(user.id);
  }

  // Admin methods
  public async listUsers(options: {
    limit?: number;
    offset?: number;
    search?: string;
  } = {}): Promise<{ users: User[]; total: number }> {
    let whereClause = '';
    const params: any[] = [];

    if (options.search) {
      whereClause = 'WHERE email LIKE ? OR full_name LIKE ?';
      params.push(`%${options.search}%`, `%${options.search}%`);
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as count FROM users ${whereClause}`;
    const countResult = this.db.queryOne(countSql, params);
    const total = countResult?.count || 0;

    // Get users
    let sql = `SELECT * FROM users ${whereClause} ORDER BY created_at DESC`;
    
    if (options.limit) {
      sql += ` LIMIT ${options.limit}`;
    }
    
    if (options.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    const rows = this.db.queryMany(sql, params);
    const users = rows.map(row => this.mapUserRow(row));

    return { users, total };
  }

  public async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    activeSessions: number;
    recentRegistrations: number;
  }> {
    const totalUsers = this.db.count('users');
    const verifiedUsers = this.db.count('users', { email_verified: true });
    
    const activeSessionsResult = this.db.queryOne(
      'SELECT COUNT(*) as count FROM sessions WHERE expires_at > datetime("now")'
    );
    const activeSessions = activeSessionsResult?.count || 0;

    const recentRegistrationsResult = this.db.queryOne(
      'SELECT COUNT(*) as count FROM users WHERE created_at > datetime("now", "-7 days")'
    );
    const recentRegistrations = recentRegistrationsResult?.count || 0;

    return {
      totalUsers,
      verifiedUsers,
      activeSessions,
      recentRegistrations,
    };
  }

  // Maintenance
  public async cleanup(): Promise<void> {
    await this.cleanupExpiredSessions();
  }

  public async healthCheck(): Promise<boolean> {
    try {
      // Try to query users table
      this.db.queryOne('SELECT COUNT(*) as count FROM users');
      return true;
    } catch {
      return false;
    }
  }
}