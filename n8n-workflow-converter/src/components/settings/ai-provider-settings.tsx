'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useAIProvider } from '@/hooks/use-ai-provider';
import { AI_PROVIDERS, AIProvider } from '@/lib/ai-providers';

export function AIProviderSettings() {
  const hookResult = useAIProvider();
  const { 
    settings, 
    loading = false, 
    error, 
    testing = false, 
    updating = false, 
    available = true, 
    updateProvider, 
    testApiKey, 
    clearSettings 
  } = hookResult || {};
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('system_default');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleProviderChange = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setApiKey('');
    setTestResult(null);
    setSaveResult(null);
  };

  const handleSave = async () => {
    try {
      setSaveResult(null);
      await updateProvider(selectedProvider, apiKey);
      setApiKey(''); // Clear the input after saving
      setTestResult(null);
      setSaveResult({
        success: true,
        message: `Successfully updated to ${AI_PROVIDERS[selectedProvider].name}!`
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSaveResult(null), 3000);
    } catch (err) {
      setSaveResult({
        success: false,
        message: 'Failed to save settings. Please try again.'
      });
    }
  };

  const handleTest = async () => {
    if (!apiKey) return;

    const isValid = await testApiKey(selectedProvider, apiKey);
    setTestResult({
      success: isValid,
      message: isValid 
        ? 'API key is valid and working!' 
        : 'API key test failed. Please check your key and try again.',
    });
  };

  const handleClear = async () => {
    try {
      await clearSettings();
      setSelectedProvider('system_default');
      setApiKey('');
      setTestResult(null);
    } catch (err) {
      // Error is handled by the hook
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Provider Settings</CardTitle>
          <CardDescription>Configure your AI provider for code generation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentProvider = settings?.provider || 'system_default';
  const providerConfig = AI_PROVIDERS[selectedProvider];

  // Debug logging
  console.log('AI Provider Settings Debug:', {
    available,
    selectedProvider,
    providerConfig,
    updating,
    apiKey: apiKey ? '[HIDDEN]' : 'empty',
    requiresKey: providerConfig.requiresKey,
    buttonDisabled: updating || (providerConfig.requiresKey && !apiKey) || (!available && selectedProvider !== 'system_default')
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Provider Settings</CardTitle>
        <CardDescription>
          Configure your preferred AI provider for code generation. You can use your own API keys or rely on the system default.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant={error.includes('not available') ? 'default' : 'destructive'}>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {error.includes('not available') && (
                <div className="mt-2 text-sm">
                  <p>The AI provider functionality requires a database schema update.</p>
                  <p>You can still use the system default AI service for now.</p>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Current Settings Display */}
        {settings && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Current Provider: {AI_PROVIDERS[currentProvider].name}</p>
                <p className="text-sm text-muted-foreground">{AI_PROVIDERS[currentProvider].description}</p>
              </div>
              <div className="flex items-center gap-2">
                {settings.isValid === true && (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                )}
                {settings.isValid === false && (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-1" />
                    Invalid
                  </Badge>
                )}
                {settings.isValid === null && AI_PROVIDERS[currentProvider].requiresKey && (
                  <Badge variant="secondary">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Untested
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Provider Selection */}
        <div className="space-y-2">
          <Label htmlFor="provider">AI Provider</Label>
          <Select 
            id="provider"
            value={selectedProvider} 
            onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
          >
            {Object.values(AI_PROVIDERS).map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} - {provider.description}
              </option>
            ))}
          </Select>
        </div>

        {/* API Key Input (only for providers that require keys) */}
        {providerConfig.requiresKey && (
          <div className="space-y-2">
            <Label htmlFor="apiKey">{providerConfig.keyLabel}</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? 'text' : 'password'}
                placeholder={providerConfig.keyPlaceholder}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key will be encrypted and stored securely. It will only be used for code generation.
            </p>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <Alert variant={testResult.success ? 'default' : 'destructive'}>
            {testResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{testResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Save Result */}
        {saveResult && (
          <Alert variant={saveResult.success ? 'default' : 'destructive'}>
            {saveResult.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <AlertDescription>{saveResult.message}</AlertDescription>
          </Alert>
        )}

        {/* Debug Info */}
        {process.env.NODE_ENV === 'development' && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
            <strong>Debug:</strong> available={available.toString()}, updating={updating.toString()}, 
            provider={selectedProvider}, requiresKey={providerConfig.requiresKey.toString()}, 
            hasApiKey={!!apiKey}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {providerConfig.requiresKey && apiKey && (
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testing || updating}
            >
              {testing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Testing...
                </>
              ) : (
                'Test API Key'
              )}
            </Button>
          )}
          
          <Button
            onClick={handleSave}
            disabled={updating || (providerConfig.requiresKey && !apiKey)}
          >
            {updating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>

          {settings && (
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={updating}
            >
              Clear Settings
            </Button>
          )}
        </div>

        {/* Provider Information */}
        <div className="pt-4 border-t">
          <h4 className="font-medium mb-2">About {providerConfig.name}</h4>
          <p className="text-sm text-muted-foreground mb-2">{providerConfig.description}</p>
          {providerConfig.requiresKey && (
            <p className="text-xs text-muted-foreground">
              You'll need to obtain an API key from {providerConfig.name} to use this provider.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}