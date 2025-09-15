'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react';
import { AnalyticsService, getAnalyticsService } from '@/lib/services/analytics-service';

interface AnalyticsContextType {
  analytics: AnalyticsService | null;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  userConsent: boolean | null;
  setUserConsent: (consent: boolean) => void;
}

const AnalyticsContext = createContext<AnalyticsContextType>({
  analytics: null,
  isEnabled: false,
  setEnabled: () => {},
  userConsent: null,
  setUserConsent: () => {}
});

interface AnalyticsProviderProps {
  children: React.ReactNode;
  defaultEnabled?: boolean;
}

export function AnalyticsProvider({ children, defaultEnabled = true }: AnalyticsProviderProps) {
  const supabase = useSupabaseClient();
  const user = useUser();
  const [analytics, setAnalytics] = useState<AnalyticsService | null>(null);
  const [isEnabled, setIsEnabled] = useState(defaultEnabled);
  const [userConsent, setUserConsent] = useState<boolean | null>(null);

  // Initialize analytics service
  useEffect(() => {
    if (supabase) {
      const analyticsService = getAnalyticsService(supabase, isEnabled && userConsent !== false);
      setAnalytics(analyticsService);
    }
  }, [supabase, isEnabled, userConsent]);

  // Load user consent from localStorage
  useEffect(() => {
    const savedConsent = localStorage.getItem('analytics-consent');
    if (savedConsent !== null) {
      setUserConsent(savedConsent === 'true');
    }
  }, []);

  // Save user consent to localStorage
  useEffect(() => {
    if (userConsent !== null) {
      localStorage.setItem('analytics-consent', userConsent.toString());
      if (analytics) {
        analytics.setEnabled(isEnabled && userConsent);
      }
    }
  }, [userConsent, isEnabled, analytics]);

  // Track user login/logout
  useEffect(() => {
    if (analytics && userConsent) {
      if (user) {
        analytics.trackLogin();
      }
    }
  }, [user, analytics, userConsent]);

  const handleSetEnabled = (enabled: boolean) => {
    setIsEnabled(enabled);
    if (analytics) {
      analytics.setEnabled(enabled && userConsent !== false);
    }
  };

  const handleSetUserConsent = (consent: boolean) => {
    setUserConsent(consent);
    if (analytics) {
      analytics.setEnabled(isEnabled && consent);
    }
  };

  const contextValue: AnalyticsContextType = {
    analytics,
    isEnabled: isEnabled && userConsent !== false,
    setEnabled: handleSetEnabled,
    userConsent,
    setUserConsent: handleSetUserConsent
  };

  return (
    <AnalyticsContext.Provider value={contextValue}>
      {children}
    </AnalyticsContext.Provider>
  );
}

export function useAnalyticsContext(): AnalyticsContextType {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error('useAnalyticsContext must be used within an AnalyticsProvider');
  }
  return context;
}

export default AnalyticsProvider;