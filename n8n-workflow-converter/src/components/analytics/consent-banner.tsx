'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Shield, BarChart3, Settings } from 'lucide-react';
import { useAnalyticsContext } from './analytics-provider';

interface ConsentBannerProps {
  className?: string;
}

export function ConsentBanner({ className }: ConsentBannerProps) {
  const { userConsent, setUserConsent } = useAnalyticsContext();
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Show banner if consent hasn't been given yet
    setIsVisible(userConsent === null);
  }, [userConsent]);

  const handleAccept = () => {
    setUserConsent(true);
    setIsVisible(false);
  };

  const handleDecline = () => {
    setUserConsent(false);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 right-4 z-50 ${className}`}>
      <Card className="max-w-2xl mx-auto shadow-lg border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Privacy & Analytics</CardTitle>
              <Badge variant="secondary" className="text-xs">
                GDPR Compliant
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription>
            We use analytics to improve your experience and our service.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {showDetails && (
            <div className="space-y-3 p-4 bg-muted rounded-lg">
              <h4 className="font-medium flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                What we collect:
              </h4>
              <ul className="text-sm space-y-1 ml-6">
                <li>• Project generation metrics and timing</li>
                <li>• Node type usage statistics (anonymized)</li>
                <li>• Feature usage patterns</li>
                <li>• Performance metrics for optimization</li>
                <li>• Error logs for debugging (no personal data)</li>
              </ul>
              
              <h4 className="font-medium flex items-center gap-2 mt-4">
                <Shield className="h-4 w-4" />
                Your privacy:
              </h4>
              <ul className="text-sm space-y-1 ml-6">
                <li>• No personal information is collected</li>
                <li>• Data is anonymized and aggregated</li>
                <li>• You can opt out at any time</li>
                <li>• Data is automatically deleted after 2 years</li>
                <li>• No third-party tracking or advertising</li>
              </ul>
            </div>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleAccept} className="flex-1">
              Accept Analytics
            </Button>
            <Button onClick={handleDecline} variant="outline" className="flex-1">
              Decline
            </Button>
            <Button
              onClick={() => setShowDetails(!showDetails)}
              variant="ghost"
              size="sm"
              className="flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              {showDetails ? 'Hide' : 'Details'}
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground text-center">
            You can change your preferences anytime in Settings. 
            By using our service, you agree to our privacy practices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConsentBanner;