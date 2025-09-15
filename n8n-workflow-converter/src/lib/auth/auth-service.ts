/**
 * Authentication Service
 * Handles user authentication and authorization
 */

import { SupabaseClient, User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
  success: boolean;
  user?: User | null;
  session?: Session | null;
  error?: string;
  requiresEmailConfirmation?: boolean;
}

export interface OAuthResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: Session | null;
  needsRefresh?: boolean;
  error?: string;
}

export interface PermissionResult {
  hasPermission: boolean;
  userRole?: string;
  error?: string;
}

export interface PasswordRequirements {
  minLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
}

export interface UserProfile {
  fullName?: string;
  avatarUrl?: string;
  password?: string;
}

export type OAuthProvider = 'google' | 'github' | 'discord' | 'facebook';

export class AuthService {
  constructor(private supabase: SupabaseClient) {}

  async signUp(email: string, password: string, profile?: UserProfile): Promise<AuthResult> {
    try {
      // Validate input
      if (!this.isValidEmail(email)) {
        return {
          success: false,
          error: 'Invalid email format',
          user: null
        };
      }

      if (!this.isValidPassword(password)) {
        return {
          success: false,
          error: 'Password must be at least 8 characters long',
          user: null
        };
      }

      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: profile ? {
            full_name: profile.fullName,
            avatar_url: profile.avatarUrl
          } : undefined
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          user: null
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session,
        requiresEmailConfirmation: !data.session
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during sign up',
        user: null
      };
    }
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return {
          success: false,
          error: error.message,
          user: null,
          requiresEmailConfirmation: error.message.includes('Email not confirmed')
        };
      }

      return {
        success: true,
        user: data.user,
        session: data.session
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during sign in',
        user: null
      };
    }
  }

  async signInWithOAuth(provider: OAuthProvider, redirectTo?: string): Promise<OAuthResult> {
    try {
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo
        }
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        url: data.url
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during OAuth sign in'
      };
    }
  }

  async signOut(): Promise<AuthResult> {
    try {
      const { error } = await this.supabase.auth.signOut();

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred during sign out'
      };
    }
  }

  async getCurrentUser(): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.getUser();

      if (error) {
        return {
          success: false,
          error: error.message,
          user: null
        };
      }

      if (!data.user) {
        return {
          success: false,
          user: null
        };
      }

      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred while getting user',
        user: null
      };
    }
  }

  async resetPassword(email: string, redirectTo?: string): Promise<AuthResult> {
    try {
      if (!this.isValidEmail(email)) {
        return {
          success: false,
          error: 'Invalid email format'
        };
      }

      const { error } = await this.supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectTo || `${window.location.origin}/auth/reset-password`
      });

      if (error) {
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred while resetting password'
      };
    }
  }

  async updateProfile(profile: UserProfile): Promise<AuthResult> {
    try {
      const updateData: any = {};

      if (profile.password) {
        updateData.password = profile.password;
      }

      if (profile.fullName || profile.avatarUrl) {
        updateData.data = {};
        if (profile.fullName) {
          updateData.data.full_name = profile.fullName;
        }
        if (profile.avatarUrl) {
          updateData.data.avatar_url = profile.avatarUrl;
        }
      }

      const { data, error } = await this.supabase.auth.updateUser(updateData);

      if (error) {
        return {
          success: false,
          error: error.message,
          user: null
        };
      }

      return {
        success: true,
        user: data.user
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred while updating profile',
        user: null
      };
    }
  }

  async refreshSession(): Promise<AuthResult> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();

      if (error) {
        return {
          success: false,
          error: error.message,
          session: null
        };
      }

      return {
        success: true,
        session: data.session,
        user: data.user
      };
    } catch (error) {
      return {
        success: false,
        error: 'An unexpected error occurred while refreshing session',
        session: null
      };
    }
  }

  async validateSession(): Promise<SessionValidationResult> {
    try {
      const { data, error } = await this.supabase.auth.getSession();

      if (error) {
        return {
          isValid: false,
          error: error.message
        };
      }

      if (!data.session) {
        return {
          isValid: false,
          needsRefresh: false
        };
      }

      const now = Date.now() / 1000;
      const expiresAt = data.session.expires_at || 0;

      if (expiresAt < now) {
        return {
          isValid: false,
          needsRefresh: true,
          session: data.session
        };
      }

      return {
        isValid: true,
        session: data.session
      };
    } catch (error) {
      return {
        isValid: false,
        error: 'An unexpected error occurred while validating session'
      };
    }
  }

  async checkPermission(userId: string, permission: string): Promise<PermissionResult> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('role, permissions')
        .eq('id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return {
            hasPermission: false,
            error: 'User not found'
          };
        }
        return {
          hasPermission: false,
          error: error.message
        };
      }

      const userRole = data.role || 'user';
      const userPermissions = data.permissions || [];

      // Admin has all permissions
      if (userRole === 'admin') {
        return {
          hasPermission: true,
          userRole
        };
      }

      // Check specific permission
      const hasPermission = userPermissions.includes(permission);

      return {
        hasPermission,
        userRole
      };
    } catch (error) {
      return {
        hasPermission: false,
        error: 'An unexpected error occurred while checking permissions'
      };
    }
  }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPassword(password: string): boolean {
    return password && password.length >= 8;
  }

  getPasswordRequirements(password: string): PasswordRequirements {
    return {
      minLength: password.length >= 8,
      hasLetter: /[a-zA-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecialChar: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
  }

  onAuthStateChange(callback: (event: string, session: Session | null) => void) {
    return this.supabase.auth.onAuthStateChange(callback);
  }

  // Utility methods for common auth checks
  async isAuthenticated(): Promise<boolean> {
    const result = await this.getCurrentUser();
    return result.success && !!result.user;
  }

  async requireAuth(): Promise<User> {
    const result = await this.getCurrentUser();
    if (!result.success || !result.user) {
      throw new Error('Authentication required');
    }
    return result.user;
  }

  async requirePermission(permission: string): Promise<void> {
    const user = await this.requireAuth();
    const permissionResult = await this.checkPermission(user.id, permission);
    
    if (!permissionResult.hasPermission) {
      throw new Error(`Permission '${permission}' required`);
    }
  }

  // Session management helpers
  async getAccessToken(): Promise<string | null> {
    const validation = await this.validateSession();
    return validation.session?.access_token || null;
  }

  async ensureValidSession(): Promise<Session> {
    const validation = await this.validateSession();
    
    if (!validation.isValid) {
      if (validation.needsRefresh) {
        const refreshResult = await this.refreshSession();
        if (!refreshResult.success || !refreshResult.session) {
          throw new Error('Session expired and refresh failed');
        }
        return refreshResult.session;
      } else {
        throw new Error('No valid session');
      }
    }

    return validation.session!;
  }
}