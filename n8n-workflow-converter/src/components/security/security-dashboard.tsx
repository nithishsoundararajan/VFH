'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  AlertTriangle, 
  FileX, 
  Activity, 
  Clock,
  MapPin,
  Monitor,
  Download,
  RefreshCw
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface SecurityEvent {
  id: string;
  event_type: string;
  ip_address: string;
  user_agent: string;
  details: any;
  severity: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
}

interface QuarantinedFile {
  id: string;
  file_name: string;
  file_size: number;
  scan_result: any;
  quarantine_reason: string;
  quarantined_at: string;
  status: 'quarantined' | 'released' | 'deleted';
}

interface UserSession {
  id: string;
  session_id: string;
  ip_address: string;
  user_agent: string;
  created_at: string;
  last_activity: string;
  expires_at: string;
}

export function SecurityDashboard() {
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [quarantinedFiles, setQuarantinedFiles] = useState<QuarantinedFile[]>([]);
  const [userSessions, setUserSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    loadSecurityData();
  }, []);

  const loadSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load security events
      const { data: events, error: eventsError } = await supabase
        .from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (eventsError) throw eventsError;

      // Load quarantined files
      const { data: files, error: filesError } = await supabase
        .from('quarantined_files')
        .select('*')
        .order('quarantined_at', { ascending: false });

      if (filesError) throw filesError;

      // Load user sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('user_sessions')
        .select('*')
        .order('last_activity', { ascending: false });

      if (sessionsError) throw sessionsError;

      setSecurityEvents(events || []);
      setQuarantinedFiles(files || []);
      setUserSessions(sessions || []);

    } catch (err) {
      console.error('Failed to load security data:', err);
      setError('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventTypeIcon = (eventType: string) => {
    switch (eventType) {
      case 'file_quarantined': return <FileX className="h-4 w-4" />;
      case 'suspicious_activity': return <AlertTriangle className="h-4 w-4" />;
      case 'rate_limit_exceeded': return <Activity className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const releaseQuarantinedFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('quarantined_files')
        .update({ 
          status: 'released',
          released_at: new Date().toISOString()
        })
        .eq('id', fileId);

      if (error) throw error;

      // Reload data
      await loadSecurityData();
    } catch (err) {
      console.error('Failed to release file:', err);
      setError('Failed to release file from quarantine');
    }
  };

  const terminateSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_sessions')
        .delete()
        .eq('session_id', sessionId);

      if (error) throw error;

      // Reload data
      await loadSecurityData();
    } catch (err) {
      console.error('Failed to terminate session:', err);
      setError('Failed to terminate session');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading security data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor security events, quarantined files, and active sessions
          </p>
        </div>
        <Button onClick={loadSecurityData} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Security Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Events</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{securityEvents.length}</div>
            <p className="text-xs text-muted-foreground">
              {securityEvents.filter(e => e.severity === 'high' || e.severity === 'critical').length} high/critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quarantined Files</CardTitle>
            <FileX className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {quarantinedFiles.filter(f => f.status === 'quarantined').length}
            </div>
            <p className="text-xs text-muted-foreground">
              {quarantinedFiles.length} total files
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Monitor className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userSessions.length}</div>
            <p className="text-xs text-muted-foreground">
              Current user sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Threat Level</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Low</div>
            <p className="text-xs text-muted-foreground">
              System status normal
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events">Security Events</TabsTrigger>
          <TabsTrigger value="quarantine">Quarantined Files</TabsTrigger>
          <TabsTrigger value="sessions">Active Sessions</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Security Events</CardTitle>
              <CardDescription>
                Latest security events and alerts from your account
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {securityEvents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No security events recorded
                  </p>
                ) : (
                  securityEvents.map((event) => (
                    <div key={event.id} className="flex items-start space-x-4 p-4 border rounded-lg">
                      <div className="flex-shrink-0">
                        {getEventTypeIcon(event.event_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium capitalize">
                            {event.event_type.replace(/_/g, ' ')}
                          </p>
                          <Badge className={getSeverityColor(event.severity)}>
                            {event.severity}
                          </Badge>
                        </div>
                        <div className="mt-1 flex items-center space-x-4 text-xs text-muted-foreground">
                          <span className="flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.ip_address}
                          </span>
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {formatDate(event.created_at)}
                          </span>
                        </div>
                        {event.details && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(event.details, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="quarantine" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Quarantined Files</CardTitle>
              <CardDescription>
                Files that have been quarantined due to security concerns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {quarantinedFiles.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No files in quarantine
                  </p>
                ) : (
                  quarantinedFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <FileX className="h-4 w-4 text-red-500" />
                          <p className="font-medium">{file.file_name}</p>
                          <Badge variant={file.status === 'quarantined' ? 'destructive' : 'secondary'}>
                            {file.status}
                          </Badge>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Size: {formatFileSize(file.file_size)} • 
                          Quarantined: {formatDate(file.quarantined_at)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Reason: {file.quarantine_reason}
                        </div>
                        {file.scan_result && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Scan Result: {file.scan_result.message || 'No details available'}
                          </div>
                        )}
                      </div>
                      {file.status === 'quarantined' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => releaseQuarantinedFile(file.id)}
                        >
                          Release
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Currently active user sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {userSessions.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No active sessions
                  </p>
                ) : (
                  userSessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <Monitor className="h-4 w-4" />
                          <p className="font-medium">Session {session.session_id.slice(0, 8)}...</p>
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          IP: {session.ip_address} • 
                          Created: {formatDate(session.created_at)}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Last Activity: {formatDate(session.last_activity)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          User Agent: {session.user_agent}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => terminateSession(session.session_id)}
                      >
                        Terminate
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}