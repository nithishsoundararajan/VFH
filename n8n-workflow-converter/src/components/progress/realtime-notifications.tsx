'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database';
import { 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Info,
  X,
  Bell,
  BellOff
} from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];
type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];

interface Notification {
  id: string;
  type: 'status_change' | 'error' | 'warning' | 'info' | 'completion';
  title: string;
  message: string;
  timestamp: Date;
  projectId?: string;
  projectName?: string;
  autoHide?: boolean;
  duration?: number;
}

interface RealtimeNotificationsProps {
  projectId?: string;
  onStatusChange?: (status: Project['status']) => void;
  onNewLog?: (log: GenerationLog) => void;
  maxNotifications?: number;
  defaultDuration?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  className?: string;
}

const notificationConfig = {
  status_change: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800'
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    textColor: 'text-red-800'
  },
  warning: {
    icon: AlertCircle,
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    textColor: 'text-yellow-800'
  },
  info: {
    icon: Info,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    textColor: 'text-blue-800'
  },
  completion: {
    icon: CheckCircle,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    textColor: 'text-green-800'
  }
};

const positionClasses = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4'
};

export function RealtimeNotifications({
  projectId,
  onStatusChange,
  onNewLog,
  maxNotifications = 5,
  defaultDuration = 5000,
  position = 'top-right',
  className = ''
}: RealtimeNotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isEnabled, setIsEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // Add a new notification
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    if (!isEnabled) return;

    const newNotification: Notification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      autoHide: notification.autoHide ?? true,
      duration: notification.duration ?? defaultDuration
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      // Keep only the most recent notifications
      return updated.slice(0, maxNotifications);
    });

    setUnreadCount(prev => prev + 1);

    // Auto-hide notification if enabled
    if (newNotification.autoHide) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
    }
  }, [isEnabled, maxNotifications, defaultDuration]);

  // Remove a notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  // Handle status changes
  const handleStatusChange = useCallback((status: Project['status'], projectName?: string) => {
    const statusMessages = {
      pending: 'Project is pending processing',
      processing: 'Project conversion started',
      completed: 'Project conversion completed successfully!',
      failed: 'Project conversion failed'
    };

    const notificationTypes = {
      pending: 'info' as const,
      processing: 'status_change' as const,
      completed: 'completion' as const,
      failed: 'error' as const
    };

    addNotification({
      type: notificationTypes[status],
      title: `Status Update${projectName ? ` - ${projectName}` : ''}`,
      message: statusMessages[status],
      projectId,
      projectName,
      autoHide: status !== 'failed', // Keep error notifications visible
      duration: status === 'completed' ? 8000 : defaultDuration
    });

    onStatusChange?.(status);
  }, [addNotification, projectId, defaultDuration, onStatusChange]);

  // Handle new logs
  const handleNewLog = useCallback((log: GenerationLog, projectName?: string) => {
    // Only show notifications for warnings and errors
    if (log.log_level === 'info') return;

    const titles = {
      warning: 'Warning',
      error: 'Error',
      info: 'Info'
    };

    addNotification({
      type: log.log_level === 'error' ? 'error' : 'warning',
      title: `${titles[log.log_level]}${projectName ? ` - ${projectName}` : ''}`,
      message: log.message,
      projectId: log.project_id,
      projectName,
      autoHide: log.log_level !== 'error', // Keep error notifications visible
      duration: log.log_level === 'error' ? 10000 : defaultDuration
    });

    onNewLog?.(log);
  }, [addNotification, defaultDuration, onNewLog]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return timestamp.toLocaleTimeString();
    }
  };

  // Reset unread count when notifications are viewed
  useEffect(() => {
    if (notifications.length === 0) {
      setUnreadCount(0);
    }
  }, [notifications.length]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Show browser notification for important events
  const showBrowserNotification = useCallback((notification: Notification) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const browserNotification = new Notification(notification.title, {
        body: notification.message,
        icon: '/favicon.ico',
        tag: notification.projectId || 'general'
      });

      // Auto-close browser notification
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }, []);

  // Show browser notifications for important events
  useEffect(() => {
    const latestNotification = notifications[0];
    if (latestNotification && (latestNotification.type === 'error' || latestNotification.type === 'completion')) {
      showBrowserNotification(latestNotification);
    }
  }, [notifications, showBrowserNotification]);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 space-y-2 max-w-sm ${className}`}>
      {/* Notification Toggle */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEnabled(!isEnabled)}
            className="h-8 w-8 p-0"
          >
            {isEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4 text-gray-400" />
            )}
          </Button>
          
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs px-1.5 py-0.5">
              {unreadCount}
            </Badge>
          )}
        </div>
        
        {notifications.length > 1 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllNotifications}
            className="text-xs h-6 px-2"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Notifications */}
      {notifications.map((notification) => {
        const config = notificationConfig[notification.type];
        const IconComponent = config.icon;

        return (
          <Alert
            key={notification.id}
            className={`
              ${config.bgColor} 
              ${config.borderColor} 
              ${config.textColor}
              border shadow-lg animate-in slide-in-from-right-full duration-300
            `}
          >
            <div className="flex items-start gap-2">
              <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-medium text-sm truncate">
                    {notification.title}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeNotification(notification.id)}
                    className="h-4 w-4 p-0 hover:bg-transparent"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                
                <AlertDescription className="text-xs mt-1">
                  {notification.message}
                </AlertDescription>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-70">
                    {formatTimestamp(notification.timestamp)}
                  </span>
                  
                  {notification.projectName && (
                    <Badge variant="outline" className="text-xs px-1 py-0">
                      {notification.projectName}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </Alert>
        );
      })}
    </div>
  );
}

// Hook to use notifications in other components
export function useRealtimeNotifications() {
  const [notificationComponent, setNotificationComponent] = useState<React.ReactNode>(null);

  const showNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    // This would integrate with a global notification system
    console.log('Notification:', notification);
  }, []);

  return {
    showNotification,
    NotificationComponent: notificationComponent
  };
}