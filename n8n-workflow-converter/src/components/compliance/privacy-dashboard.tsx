'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, 
  Download, 
  Trash2, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  FileText,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PrivacySettings {
  id: string;
  analytics_consent: boolean;
  marketing_consent: boolean;
  functional_cookies: boolean;
  data_sharing_consent: boolean;
  email_notifications: boolean;
  security_notifications: boolean;
  data_retention_period: number;
  auto_delete_enabled: boolean;
  updated_at: string;
}

interface ConsentRecord {
  id: string;
  consent_type: string;
  consent_given: boolean;
  consent_version: string;
  created_at: string;
}

interface DataExport {
  id: string;
  export_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  file_size: number;
  expires_at: string;
  created_at: string;
}

export function PrivacyDashboard() {
  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);
  const [consentHistory, setConsentHistory] = useState<ConsentRecord[]>([]);
  const [dataExports, setDataExports] = useState<DataExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadPrivacyData();
  }, []);

  const loadPrivacyData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load privacy settings
      const privacyResponse = await fetch('/api/compliance/privacy');
      if (!privacyResponse.ok) {
        throw new Error('Failed to load privacy settings');
      }
      const privacyData = await privacyResponse.json();
      
      setPrivacySettings(privacyData.privacySettings);
      setConsentHistory(privacyData.consentHistory || []);

      // Load export history
      const exportsResponse = await fetch('/api/compliance/export');
      if (exportsResponse.ok) {
        const exportsData = await exportsResponse.json();
        setDataExports(exportsData.exports || []);
      }

    } catch (err) {
      console.error('Failed to load privacy data:', err);
      setError('Failed to load privacy data');
    } finally {
      setLoading(false);
    }
  };

  const updatePrivacySettings = async (updates: Partial<PrivacySettings>) => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/compliance/privacy', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error('Failed to update privacy settings');
      }

      const data = await response.json();
      setPrivacySettings(data.privacySettings);
      setSuccess('Privacy settings updated successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      console.error('Failed to update privacy settings:', err);
      setError('Failed to update privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const recordConsent = async (consentType: string, consentGiven: boolean) => {
    try {
      const response = await fetch('/api/compliance/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'record_consent',
          consentType,
          consentGiven
        })
      });

      if (!response.ok) {
        throw new Error('Failed to record consent');
      }

      // Reload data to show updated consent
      await loadPrivacyData();
      setSuccess(`Consent ${consentGiven ? 'given' : 'withdrawn'} successfully`);
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      console.error('Failed to record consent:', err);
      setError('Failed to record consent');
    }
  };

  const exportData = async () => {
    try {
      setExporting(true);
      setError(null);

      const response = await fetch('/api/compliance/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          includeProjects: true,
          includeAnalytics: privacySettings?.analytics_consent || false,
          includeSecurityEvents: false,
          includeSessions: false,
          includeFiles: true,
          format: 'json'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      const data = await response.json();
      setSuccess('Data export started successfully. You will be notified when it\'s ready for download.');
      
      // Reload exports to show the new one
      setTimeout(() => {
        loadPrivacyData();
        setSuccess(null);
      }, 3000);

    } catch (err) {
      console.error('Failed to export data:', err);
      setError('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const applyDataRetention = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/compliance/privacy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'apply_retention'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to apply data retention');
      }

      const data = await response.json();
      if (data.success) {
        setSuccess('Data retention policies applied successfully');
      } else {
        setError('Data retention completed with some errors');
      }
      
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);

    } catch (err) {
      console.error('Failed to apply data retention:', err);
      setError('Failed to apply data retention policies');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing': return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        <span className="ml-2">Loading privacy settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Privacy & Data Control</h1>
          <p className="text-muted-foreground">
            Manage your privacy settings, data exports, and consent preferences
          </p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={exportData} disabled={exporting} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exporting...' : 'Export My Data'}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">Privacy Settings</TabsTrigger>
          <TabsTrigger value="consent">Consent History</TabsTrigger>
          <TabsTrigger value="exports">Data Exports</TabsTrigger>
          <TabsTrigger value="retention">Data Retention</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Privacy Preferences
              </CardTitle>
              <CardDescription>
                Control how your data is used and processed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {privacySettings && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="analytics">Analytics & Performance</Label>
                        <p className="text-sm text-muted-foreground">
                          Help us improve the service by sharing usage analytics
                        </p>
                      </div>
                      <Switch
                        id="analytics"
                        checked={privacySettings.analytics_consent}
                        onCheckedChange={(checked) => {
                          updatePrivacySettings({ analytics_consent: checked });
                          recordConsent('analytics', checked);
                        }}
                        disabled={saving}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="marketing">Marketing Communications</Label>
                        <p className="text-sm text-muted-foreground">
                          Receive updates about new features and improvements
                        </p>
                      </div>
                      <Switch
                        id="marketing"
                        checked={privacySettings.marketing_consent}
                        onCheckedChange={(checked) => {
                          updatePrivacySettings({ marketing_consent: checked });
                          recordConsent('marketing', checked);
                        }}
                        disabled={saving}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="functional">Functional Cookies</Label>
                        <p className="text-sm text-muted-foreground">
                          Essential cookies required for the service to function
                        </p>
                      </div>
                      <Switch
                        id="functional"
                        checked={privacySettings.functional_cookies}
                        onCheckedChange={(checked) => {
                          updatePrivacySettings({ functional_cookies: checked });
                          recordConsent('functional', checked);
                        }}
                        disabled={saving || true} // Always required
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="sharing">Data Sharing</Label>
                        <p className="text-sm text-muted-foreground">
                          Allow sharing anonymized data with research partners
                        </p>
                      </div>
                      <Switch
                        id="sharing"
                        checked={privacySettings.data_sharing_consent}
                        onCheckedChange={(checked) => {
                          updatePrivacySettings({ data_sharing_consent: checked });
                          recordConsent('data_sharing', checked);
                        }}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-4">Notification Preferences</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="email-notifications">Email Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Receive email updates about your projects
                          </p>
                        </div>
                        <Switch
                          id="email-notifications"
                          checked={privacySettings.email_notifications}
                          onCheckedChange={(checked) => 
                            updatePrivacySettings({ email_notifications: checked })
                          }
                          disabled={saving}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label htmlFor="security-notifications">Security Notifications</Label>
                          <p className="text-sm text-muted-foreground">
                            Important security alerts and login notifications
                          </p>
                        </div>
                        <Switch
                          id="security-notifications"
                          checked={privacySettings.security_notifications}
                          onCheckedChange={(checked) => 
                            updatePrivacySettings({ security_notifications: checked })
                          }
                          disabled={saving || true} // Always recommended
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                Consent History
              </CardTitle>
              <CardDescription>
                Track of all consent decisions you've made
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {consentHistory.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No consent records found
                  </p>
                ) : (
                  consentHistory.map((record) => (
                    <div key={record.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {record.consent_given ? (
                          <Eye className="h-4 w-4 text-green-500" />
                        ) : (
                          <EyeOff className="h-4 w-4 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium capitalize">
                            {record.consent_type.replace(/_/g, ' ')}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(record.created_at)}
                          </p>
                        </div>
                      </div>
                      <Badge variant={record.consent_given ? 'default' : 'secondary'}>
                        {record.consent_given ? 'Granted' : 'Withdrawn'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="exports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Download className="h-5 w-5 mr-2" />
                Data Export History
              </CardTitle>
              <CardDescription>
                Download copies of your personal data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {dataExports.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No data exports found
                  </p>
                ) : (
                  dataExports.map((exportRecord) => (
                    <div key={exportRecord.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(exportRecord.status)}
                        <div>
                          <p className="font-medium">
                            {exportRecord.export_type.toUpperCase()} Export
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Created: {formatDate(exportRecord.created_at)}
                          </p>
                          {exportRecord.file_size > 0 && (
                            <p className="text-sm text-muted-foreground">
                              Size: {formatFileSize(exportRecord.file_size)}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={
                          exportRecord.status === 'completed' ? 'default' :
                          exportRecord.status === 'failed' ? 'destructive' : 'secondary'
                        }>
                          {exportRecord.status}
                        </Badge>
                        {exportRecord.status === 'completed' && (
                          <Button size="sm" variant="outline">
                            Download
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="retention" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trash2 className="h-5 w-5 mr-2" />
                Data Retention
              </CardTitle>
              <CardDescription>
                Control how long your data is stored
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {privacySettings && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label htmlFor="auto-delete">Automatic Data Cleanup</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically delete old data based on retention period
                        </p>
                      </div>
                      <Switch
                        id="auto-delete"
                        checked={privacySettings.auto_delete_enabled}
                        onCheckedChange={(checked) => 
                          updatePrivacySettings({ auto_delete_enabled: checked })
                        }
                        disabled={saving}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="retention-period">Data Retention Period</Label>
                      <p className="text-sm text-muted-foreground">
                        How long to keep your data (30-2555 days)
                      </p>
                      <div className="flex items-center space-x-2">
                        <input
                          id="retention-period"
                          type="number"
                          min="30"
                          max="2555"
                          value={privacySettings.data_retention_period}
                          onChange={(e) => {
                            const value = parseInt(e.target.value);
                            if (value >= 30 && value <= 2555) {
                              updatePrivacySettings({ data_retention_period: value });
                            }
                          }}
                          className="w-24 px-3 py-2 border rounded-md"
                          disabled={saving}
                        />
                        <span className="text-sm text-muted-foreground">days</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Apply Retention Policies Now</h4>
                        <p className="text-sm text-muted-foreground">
                          Immediately clean up data older than your retention period
                        </p>
                      </div>
                      <Button 
                        onClick={applyDataRetention}
                        disabled={saving}
                        variant="outline"
                      >
                        {saving ? 'Applying...' : 'Apply Now'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}