import { createClient } from '@/lib/supabase/server';

export interface PrivacySettings {
  id: string;
  user_id: string;
  analytics_consent: boolean;
  marketing_consent: boolean;
  functional_cookies: boolean;
  data_sharing_consent: boolean;
  email_notifications: boolean;
  security_notifications: boolean;
  data_retention_period: number; // days
  auto_delete_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  consent_given: boolean;
  consent_version: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
}

export interface DataRetentionPolicy {
  dataType: string;
  retentionPeriod: number; // days
  description: string;
  required: boolean;
}

/**
 * Privacy controls and consent management service
 */
export class PrivacyControlsService {
  private static readonly DEFAULT_RETENTION_PERIOD = 365; // 1 year
  private static readonly CONSENT_VERSION = '1.0';

  /**
   * Get user privacy settings
   */
  static async getPrivacySettings(userId: string): Promise<PrivacySettings | null> {
    try {
      const supabase = await createClient();
      
      const { data: settings, error } = await supabase
        .from('privacy_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw error;
      }

      // Return default settings if none exist
      if (!settings) {
        return await this.createDefaultPrivacySettings(userId);
      }

      return settings;
    } catch (error) {
      console.error('Failed to get privacy settings:', error);
      throw new Error('Failed to retrieve privacy settings');
    }
  }

  /**
   * Update user privacy settings
   */
  static async updatePrivacySettings(
    userId: string,
    updates: Partial<PrivacySettings>,
    ipAddress: string,
    userAgent: string
  ): Promise<PrivacySettings> {
    try {
      const supabase = await createClient();
      
      // Get current settings
      const currentSettings = await this.getPrivacySettings(userId);
      if (!currentSettings) {
        throw new Error('Privacy settings not found');
      }

      // Update settings
      const { data: updatedSettings, error } = await supabase
        .from('privacy_settings')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Log consent changes
      await this.logConsentChanges(
        userId,
        currentSettings,
        updatedSettings,
        ipAddress,
        userAgent
      );

      return updatedSettings;
    } catch (error) {
      console.error('Failed to update privacy settings:', error);
      throw new Error('Failed to update privacy settings');
    }
  }

  /**
   * Record user consent for specific purposes
   */
  static async recordConsent(
    userId: string,
    consentType: string,
    consentGiven: boolean,
    ipAddress: string,
    userAgent: string
  ): Promise<ConsentRecord> {
    try {
      const supabase = await createClient();
      
      const consentRecord = {
        user_id: userId,
        consent_type: consentType,
        consent_given: consentGiven,
        consent_version: this.CONSENT_VERSION,
        ip_address: ipAddress,
        user_agent: userAgent
      };

      const { data: record, error } = await supabase
        .from('consent_records')
        .insert(consentRecord)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Update privacy settings if applicable
      await this.updatePrivacySettingsFromConsent(userId, consentType, consentGiven);

      return record;
    } catch (error) {
      console.error('Failed to record consent:', error);
      throw new Error('Failed to record consent');
    }
  }

  /**
   * Get consent history for a user
   */
  static async getConsentHistory(userId: string): Promise<ConsentRecord[]> {
    try {
      const supabase = await createClient();
      
      const { data: records, error } = await supabase
        .from('consent_records')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return records || [];
    } catch (error) {
      console.error('Failed to get consent history:', error);
      return [];
    }
  }

  /**
   * Check if user has given consent for a specific purpose
   */
  static async hasConsent(userId: string, consentType: string): Promise<boolean> {
    try {
      const settings = await this.getPrivacySettings(userId);
      if (!settings) {
        return false;
      }

      switch (consentType) {
        case 'analytics':
          return settings.analytics_consent;
        case 'marketing':
          return settings.marketing_consent;
        case 'functional':
          return settings.functional_cookies;
        case 'data_sharing':
          return settings.data_sharing_consent;
        default:
          return false;
      }
    } catch (error) {
      console.error('Failed to check consent:', error);
      return false;
    }
  }

  /**
   * Get data retention policies
   */
  static getDataRetentionPolicies(): DataRetentionPolicy[] {
    return [
      {
        dataType: 'user_profile',
        retentionPeriod: -1, // Indefinite (until account deletion)
        description: 'User profile information including name, email, and preferences',
        required: true
      },
      {
        dataType: 'projects',
        retentionPeriod: 365,
        description: 'Workflow projects and generated code',
        required: false
      },
      {
        dataType: 'analytics',
        retentionPeriod: 730, // 2 years
        description: 'Usage analytics and performance metrics',
        required: false
      },
      {
        dataType: 'security_events',
        retentionPeriod: 90,
        description: 'Security logs and audit trails',
        required: true
      },
      {
        dataType: 'session_data',
        retentionPeriod: 30,
        description: 'User session information',
        required: true
      },
      {
        dataType: 'generation_logs',
        retentionPeriod: 180,
        description: 'Code generation logs and error messages',
        required: false
      }
    ];
  }

  /**
   * Apply data retention policies (cleanup old data)
   */
  static async applyDataRetention(userId: string): Promise<{
    deletedItems: Record<string, number>;
    errors: string[];
  }> {
    const supabase = await createClient();
    const deletedItems: Record<string, number> = {};
    const errors: string[] = [];

    try {
      const settings = await this.getPrivacySettings(userId);
      if (!settings) {
        throw new Error('Privacy settings not found');
      }

      const retentionPeriod = settings.data_retention_period || this.DEFAULT_RETENTION_PERIOD;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionPeriod);

      // Clean up analytics data (if consent withdrawn)
      if (!settings.analytics_consent) {
        try {
          const { count, error } = await supabase
            .from('project_analytics')
            .delete()
            .eq('user_id', userId);
          
          if (error) throw error;
          deletedItems.analytics = count || 0;
        } catch (error) {
          errors.push(`Failed to delete analytics: ${error}`);
        }
      }

      // Clean up old security events (keep required retention period)
      const securityRetentionDate = new Date();
      securityRetentionDate.setDate(securityRetentionDate.getDate() - 90);
      
      try {
        const { count, error } = await supabase
          .from('security_events')
          .delete()
          .eq('user_id', userId)
          .lt('created_at', securityRetentionDate.toISOString());
        
        if (error) throw error;
        deletedItems.oldSecurityEvents = count || 0;
      } catch (error) {
        errors.push(`Failed to delete old security events: ${error}`);
      }

      // Clean up old sessions
      const sessionRetentionDate = new Date();
      sessionRetentionDate.setDate(sessionRetentionDate.getDate() - 30);
      
      try {
        const { count, error } = await supabase
          .from('user_sessions')
          .delete()
          .eq('user_id', userId)
          .lt('created_at', sessionRetentionDate.toISOString());
        
        if (error) throw error;
        deletedItems.oldSessions = count || 0;
      } catch (error) {
        errors.push(`Failed to delete old sessions: ${error}`);
      }

      // Clean up old generation logs
      const logsRetentionDate = new Date();
      logsRetentionDate.setDate(logsRetentionDate.getDate() - 180);
      
      try {
        const { data: projects } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', userId);

        if (projects && projects.length > 0) {
          const projectIds = projects.map(p => p.id);
          
          const { count, error } = await supabase
            .from('generation_logs')
            .delete()
            .in('project_id', projectIds)
            .lt('created_at', logsRetentionDate.toISOString());
          
          if (error) throw error;
          deletedItems.oldLogs = count || 0;
        }
      } catch (error) {
        errors.push(`Failed to delete old generation logs: ${error}`);
      }

      return { deletedItems, errors };
    } catch (error) {
      console.error('Data retention cleanup failed:', error);
      errors.push(`Data retention cleanup failed: ${error}`);
      return { deletedItems, errors };
    }
  }

  /**
   * Create default privacy settings for new users
   */
  private static async createDefaultPrivacySettings(userId: string): Promise<PrivacySettings> {
    try {
      const supabase = await createClient();
      
      const defaultSettings = {
        user_id: userId,
        analytics_consent: false, // Opt-in required
        marketing_consent: false, // Opt-in required
        functional_cookies: true, // Essential for functionality
        data_sharing_consent: false, // Opt-in required
        email_notifications: true,
        security_notifications: true, // Important for security
        data_retention_period: this.DEFAULT_RETENTION_PERIOD,
        auto_delete_enabled: false
      };

      const { data: settings, error } = await supabase
        .from('privacy_settings')
        .insert(defaultSettings)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return settings;
    } catch (error) {
      console.error('Failed to create default privacy settings:', error);
      throw new Error('Failed to create privacy settings');
    }
  }

  /**
   * Log consent changes for audit purposes
   */
  private static async logConsentChanges(
    userId: string,
    oldSettings: PrivacySettings,
    newSettings: PrivacySettings,
    ipAddress: string,
    userAgent: string
  ): Promise<void> {
    try {
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];
      
      const fieldsToCheck = [
        'analytics_consent',
        'marketing_consent',
        'functional_cookies',
        'data_sharing_consent',
        'email_notifications',
        'security_notifications',
        'data_retention_period',
        'auto_delete_enabled'
      ];

      for (const field of fieldsToCheck) {
        if (oldSettings[field as keyof PrivacySettings] !== newSettings[field as keyof PrivacySettings]) {
          changes.push({
            field,
            oldValue: oldSettings[field as keyof PrivacySettings],
            newValue: newSettings[field as keyof PrivacySettings]
          });
        }
      }

      if (changes.length > 0) {
        const supabase = await createClient();
        
        await supabase.from('audit_logs').insert({
          user_id: userId,
          action: 'privacy_settings_updated',
          resource_type: 'privacy_settings',
          resource_id: newSettings.id,
          details: {
            changes,
            timestamp: new Date().toISOString()
          },
          ip_address: ipAddress,
          user_agent: userAgent
        });
      }
    } catch (error) {
      console.error('Failed to log consent changes:', error);
      // Don't throw - settings update should succeed even if logging fails
    }
  }

  /**
   * Update privacy settings based on consent record
   */
  private static async updatePrivacySettingsFromConsent(
    userId: string,
    consentType: string,
    consentGiven: boolean
  ): Promise<void> {
    try {
      const supabase = await createClient();
      
      const updates: Partial<PrivacySettings> = {};
      
      switch (consentType) {
        case 'analytics':
          updates.analytics_consent = consentGiven;
          break;
        case 'marketing':
          updates.marketing_consent = consentGiven;
          break;
        case 'functional':
          updates.functional_cookies = consentGiven;
          break;
        case 'data_sharing':
          updates.data_sharing_consent = consentGiven;
          break;
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('privacy_settings')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error('Failed to update privacy settings from consent:', error);
      // Don't throw - consent recording should succeed even if settings update fails
    }
  }
}