export const authConfig = {
  // OAuth provider configurations
  providers: {
    google: {
      enabled: true,
      scopes: 'openid email profile',
    },
    github: {
      enabled: true,
      scopes: 'user:email',
    },
  },
  
  // Redirect URLs
  redirectUrls: {
    signIn: '/dashboard',
    signOut: '/',
    callback: '/auth/callback',
    resetPassword: '/auth/reset-password',
  },
  
  // Email settings
  email: {
    confirmSignUp: true,
    autoConfirm: process.env.NODE_ENV === 'development',
  },
  
  // Session settings
  session: {
    persistSession: true,
    detectSessionInUrl: true,
  },
} as const;

export type AuthProvider = keyof typeof authConfig.providers;