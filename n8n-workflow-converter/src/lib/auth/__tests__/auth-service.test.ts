/**
 * Authentication Service Tests
 * Tests for authentication and authorization functionality
 */

import { AuthService } from '../auth-service';
import { createClient } from '@supabase/supabase-js';

// Mock Supabase client
const mockSupabase = {
  auth: {
    signUp: jest.fn(),
    signInWithPassword: jest.fn(),
    signInWithOAuth: jest.fn(),
    signOut: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
    resetPasswordForEmail: jest.fn(),
    updateUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    refreshSession: jest.fn()
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn().mockResolvedValue({ data: null, error: null })
      }))
    })),
    insert: jest.fn().mockResolvedValue({ data: null, error: null }),
    update: jest.fn(() => ({
      eq: jest.fn().mockResolvedValue({ data: null, error: null })
    }))
  }))
} as any;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    authService = new AuthService(mockSupabase);
  });

  describe('signUp', () => {
    it('should sign up a new user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        email_confirmed_at: null
      };

      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: mockUser, session: null },
        error: null
      });

      const result = await authService.signUp('test@example.com', 'password123', {
        fullName: 'Test User'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.requiresEmailConfirmation).toBe(true);
      expect(mockSupabase.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
        options: {
          data: {
            full_name: 'Test User'
          }
        }
      });
    });

    it('should handle sign up errors', async () => {
      mockSupabase.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email already registered' }
      });

      const result = await authService.signUp('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already registered');
      expect(result.user).toBeNull();
    });

    it('should validate email format', async () => {
      const result = await authService.signUp('invalid-email', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email format');
      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });

    it('should validate password strength', async () => {
      const result = await authService.signUp('test@example.com', '123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Password must be at least 8 characters long');
      expect(mockSupabase.auth.signUp).not.toHaveBeenCalled();
    });
  });

  describe('signIn', () => {
    it('should sign in user successfully', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };
      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-123'
      };

      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null
      });

      const result = await authService.signIn('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(result.session).toEqual(mockSession);
      expect(mockSupabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123'
      });
    });

    it('should handle invalid credentials', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' }
      });

      const result = await authService.signIn('test@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid login credentials');
      expect(result.user).toBeNull();
    });

    it('should handle unconfirmed email', async () => {
      mockSupabase.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Email not confirmed' }
      });

      const result = await authService.signIn('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email not confirmed');
      expect(result.requiresEmailConfirmation).toBe(true);
    });
  });

  describe('signInWithOAuth', () => {
    it('should initiate OAuth sign in', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: 'https://oauth-provider.com/auth' },
        error: null
      });

      const result = await authService.signInWithOAuth('google', 'https://app.com/callback');

      expect(result.success).toBe(true);
      expect(result.url).toBe('https://oauth-provider.com/auth');
      expect(mockSupabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: 'https://app.com/callback'
        }
      });
    });

    it('should handle OAuth errors', async () => {
      mockSupabase.auth.signInWithOAuth.mockResolvedValue({
        data: { url: null },
        error: { message: 'OAuth provider not configured' }
      });

      const result = await authService.signInWithOAuth('github');

      expect(result.success).toBe(false);
      expect(result.error).toBe('OAuth provider not configured');
    });
  });

  describe('signOut', () => {
    it('should sign out user successfully', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: null
      });

      const result = await authService.signOut();

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle sign out errors', async () => {
      mockSupabase.auth.signOut.mockResolvedValue({
        error: { message: 'Sign out failed' }
      });

      const result = await authService.signOut();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Sign out failed');
    });
  });

  describe('getCurrentUser', () => {
    it('should get current authenticated user', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
    });

    it('should handle no authenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.user).toBeNull();
    });

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'JWT expired' }
      });

      const result = await authService.getCurrentUser();

      expect(result.success).toBe(false);
      expect(result.error).toBe('JWT expired');
    });
  });

  describe('resetPassword', () => {
    it('should send password reset email', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: null
      });

      const result = await authService.resetPassword('test@example.com');

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.resetPasswordForEmail).toHaveBeenCalledWith(
        'test@example.com',
        { redirectTo: expect.any(String) }
      );
    });

    it('should handle reset password errors', async () => {
      mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({
        data: {},
        error: { message: 'Email not found' }
      });

      const result = await authService.resetPassword('test@example.com');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Email not found');
    });
  });

  describe('updateProfile', () => {
    it('should update user profile', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await authService.updateProfile({
        fullName: 'Updated Name',
        avatarUrl: 'https://example.com/avatar.jpg'
      });

      expect(result.success).toBe(true);
      expect(result.user).toEqual(mockUser);
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        data: {
          full_name: 'Updated Name',
          avatar_url: 'https://example.com/avatar.jpg'
        }
      });
    });

    it('should update password', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com'
      };

      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await authService.updateProfile({
        password: 'newpassword123'
      });

      expect(result.success).toBe(true);
      expect(mockSupabase.auth.updateUser).toHaveBeenCalledWith({
        password: 'newpassword123'
      });
    });

    it('should handle profile update errors', async () => {
      mockSupabase.auth.updateUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Update failed' }
      });

      const result = await authService.updateProfile({
        fullName: 'Updated Name'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Update failed');
    });
  });

  describe('refreshSession', () => {
    it('should refresh user session', async () => {
      const mockSession = {
        access_token: 'new-token-123',
        refresh_token: 'new-refresh-123'
      };

      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('should handle refresh errors', async () => {
      mockSupabase.auth.refreshSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'Refresh token expired' }
      });

      const result = await authService.refreshSession();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Refresh token expired');
    });
  });

  describe('validateSession', () => {
    it('should validate active session', async () => {
      const mockSession = {
        access_token: 'token-123',
        expires_at: Date.now() / 1000 + 3600 // 1 hour from now
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.validateSession();

      expect(result.isValid).toBe(true);
      expect(result.session).toEqual(mockSession);
    });

    it('should detect expired session', async () => {
      const mockSession = {
        access_token: 'token-123',
        expires_at: Date.now() / 1000 - 3600 // 1 hour ago
      };

      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: mockSession },
        error: null
      });

      const result = await authService.validateSession();

      expect(result.isValid).toBe(false);
      expect(result.needsRefresh).toBe(true);
    });

    it('should handle no session', async () => {
      mockSupabase.auth.getSession.mockResolvedValue({
        data: { session: null },
        error: null
      });

      const result = await authService.validateSession();

      expect(result.isValid).toBe(false);
      expect(result.needsRefresh).toBe(false);
    });
  });

  describe('authorization', () => {
    it('should check user permissions', async () => {
      const mockProfile = {
        id: 'user-123',
        role: 'admin',
        permissions: ['read', 'write', 'delete']
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const result = await authService.checkPermission('user-123', 'write');

      expect(result.hasPermission).toBe(true);
      expect(result.userRole).toBe('admin');
    });

    it('should deny permission for insufficient role', async () => {
      const mockProfile = {
        id: 'user-123',
        role: 'user',
        permissions: ['read']
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockProfile,
        error: null
      });

      const result = await authService.checkPermission('user-123', 'delete');

      expect(result.hasPermission).toBe(false);
      expect(result.userRole).toBe('user');
    });

    it('should handle user not found', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await authService.checkPermission('user-123', 'read');

      expect(result.hasPermission).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('validation helpers', () => {
    it('should validate email format', () => {
      expect(authService.isValidEmail('test@example.com')).toBe(true);
      expect(authService.isValidEmail('user+tag@domain.co.uk')).toBe(true);
      expect(authService.isValidEmail('invalid-email')).toBe(false);
      expect(authService.isValidEmail('test@')).toBe(false);
      expect(authService.isValidEmail('@example.com')).toBe(false);
    });

    it('should validate password strength', () => {
      expect(authService.isValidPassword('password123')).toBe(true);
      expect(authService.isValidPassword('StrongP@ss1')).toBe(true);
      expect(authService.isValidPassword('123')).toBe(false);
      expect(authService.isValidPassword('')).toBe(false);
    });

    it('should check password requirements', () => {
      const requirements = authService.getPasswordRequirements('password123');
      expect(requirements.minLength).toBe(true);
      expect(requirements.hasLetter).toBe(true);
      expect(requirements.hasNumber).toBe(true);

      const weakRequirements = authService.getPasswordRequirements('abc');
      expect(weakRequirements.minLength).toBe(false);
      expect(weakRequirements.hasLetter).toBe(true);
      expect(weakRequirements.hasNumber).toBe(false);
    });
  });

  describe('auth state management', () => {
    it('should set up auth state listener', () => {
      const callback = jest.fn();
      authService.onAuthStateChange(callback);

      expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledWith(callback);
    });

    it('should handle auth state changes', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();

      mockSupabase.auth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: mockUnsubscribe } }
      });

      const subscription = authService.onAuthStateChange(callback);
      subscription.unsubscribe();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});