'use client';

/**
 * Configuration dashboard for self-hosted instances
 * Provides web-based interface for managing application settings
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Database, 
  Shield, 
  Zap, 
  Monitor, 
  Download, 
  Upload, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';

interface ConfigSetting {
  key: string;
  name: string;
  description: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'password' | 'json';
  value: any;
  defaultValue: any;
  required: boolean;
  options?: { label: string; value: any }[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
  sensitive?: boolean;
  restartRequired?: boolean;
}

interface ConfigSection {
  id: string;
  name: string;
  description: string;
  settings: ConfigSetting[];
}

interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  defaultEnabled: boolean;
  dependencies?: string[];
  incompatible?: string[];
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'error';
  services: {
    [key: string]: {
      status: 'healthy' | 'warning' | 'error';
      message?: string;
      lastCheck: Date;
    };
  };
  metrics: {
    [key: string]: {
      value: number;
      unit: string;
      threshold?: number;
      status: 'normal' | 'warning' | 'critical';
    };
  };
}

export function ConfigDashboard() {
  const [configSections, setConfigSections] = useState<ConfigSection[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    loadConfiguration();
    loadSystemHealth();
    
    // Refresh health status every 30 seconds
    const healthInterval = setInterval(loadSystemHealth, 30000);
    
    return () => clearInterval(healthInterval);
  }, []);

  const loadConfiguration = async () => {
    try {
      const response = await fetch('/api/admin/config');
      if (!response.ok) throw new Error('Failed to load configuration');
      
      const data = await response.json();
      setConfigSections(data.sections);
      setFeatureFlags(data.featureFlags);
      setLoading(false);
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  };

  const loadSystemHealth = async () => {
    try {
      const response = await fetch('/api/admin/health');
      if (!response.ok) throw new Error('Failed to load system health');
      
      const data = await response.json();
      setSystemHealth(data);
    } catch (err) {
      console.error('Failed to load system health:', err);
    }
  };

  const handleSettingChange = (key: string, value: any) => {
    setPendingChanges(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleFeatureFlagChange = async (key: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/admin/config/features', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, enabled }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      setFeatureFlags(prev => 
        prev.map(flag => 
          flag.key === key ? { ...flag, enabled } : flag
        )
      );

      setSuccess('Feature flag updated successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const saveConfiguration = async () => {
    if (Object.keys(pendingChanges).length === 0) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: pendingChanges }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const data = await response.json();
      
      // Update local state
      setConfigSections(data.sections);
      setPendingChanges({});
      
      setSuccess('Configuration saved successfully');
      setTimeout(() => setSuccess(null), 3000);

      // Check if restart is required
      if (data.restartRequired) {
        setError('Some changes require a restart to take effect');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const exportConfiguration = async () => {
    try {
      const response = await fetch('/api/admin/config/export');
      if (!response.ok) throw new Error('Failed to export configuration');
      
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `config-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const importConfiguration = async (file: File) => {
    try {
      const text = await file.text();
      
      const response = await fetch('/api/admin/config/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: text }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      await loadConfiguration();
      setSuccess('Configuration imported successfully');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const renderSettingInput = (setting: ConfigSetting) => {
    const currentValue = pendingChanges[setting.key] ?? setting.value;

    switch (setting.type) {
      case 'boolean':
        return (
          <Switch
            checked={currentValue}
            onCheckedChange={(checked) => handleSettingChange(setting.key, checked)}
          />
        );

      case 'select':
        return (
          <Select
            value={currentValue}
            onValueChange={(value) => handleSettingChange(setting.key, value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {setting.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.key, parseInt(e.target.value))}
            min={setting.validation?.min}
            max={setting.validation?.max}
          />
        );

      case 'password':
        return (
          <Input
            type="password"
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            placeholder={setting.sensitive ? '••••••••' : ''}
          />
        );

      case 'json':
        return (
          <Textarea
            value={typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue, null, 2)}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
            rows={4}
            className="font-mono text-sm"
          />
        );

      default:
        return (
          <Input
            type="text"
            value={currentValue}
            onChange={(e) => handleSettingChange(setting.key, e.target.value)}
          />
        );
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'normal':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Configuration Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your self-hosted n8n Workflow Converter instance
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={exportConfiguration}
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export
          </Button>
          
          <Button
            variant="outline"
            onClick={() => document.getElementById('import-file')?.click()}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Import
          </Button>
          
          <input
            id="import-file"
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importConfiguration(file);
            }}
          />
          
          <Button
            onClick={saveConfiguration}
            disabled={saving || Object.keys(pendingChanges).length === 0}
            className="flex items-center gap-2"
          >
            {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Alerts */}
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

      {/* System Health */}
      {systemHealth && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              System Health
              {getStatusIcon(systemHealth.status)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(systemHealth.services).map(([name, service]) => (
                <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{name}</div>
                    <div className="text-sm text-muted-foreground">{service.message}</div>
                  </div>
                  {getStatusIcon(service.status)}
                </div>
              ))}
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(systemHealth.metrics).map(([name, metric]) => (
                <div key={name} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium capitalize">{name.replace(/([A-Z])/g, ' $1')}</div>
                    <div className="text-sm text-muted-foreground">
                      {metric.value} {metric.unit}
                    </div>
                  </div>
                  {getStatusIcon(metric.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        {configSections.map((section) => (
          <TabsContent key={section.id} value={section.id}>
            <Card>
              <CardHeader>
                <CardTitle>{section.name}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {section.settings.map((setting) => (
                  <div key={setting.key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor={setting.key} className="flex items-center gap-2">
                        {setting.name}
                        {setting.required && <span className="text-red-500">*</span>}
                        {setting.restartRequired && (
                          <Badge variant="outline" className="text-xs">
                            Restart Required
                          </Badge>
                        )}
                      </Label>
                      {pendingChanges[setting.key] !== undefined && (
                        <Badge variant="secondary" className="text-xs">
                          Modified
                        </Badge>
                      )}
                    </div>
                    
                    {renderSettingInput(setting)}
                    
                    {setting.description && (
                      <p className="text-sm text-muted-foreground">
                        {setting.description}
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* Feature Flags Tab */}
        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Feature Flags
              </CardTitle>
              <CardDescription>
                Enable or disable application features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {featureFlags.map((flag) => (
                <div key={flag.key} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="font-medium">{flag.name}</div>
                    <div className="text-sm text-muted-foreground">{flag.description}</div>
                    {flag.dependencies && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">Requires:</span>
                        {flag.dependencies.map((dep) => (
                          <Badge key={dep} variant="outline" className="text-xs">
                            {dep}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={(checked) => handleFeatureFlagChange(flag.key, checked)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}