'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Database } from '@/types/database';
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  XCircle, 
  RefreshCw,
  Loader2
} from 'lucide-react';

type ProjectStatus = Database['public']['Tables']['projects']['Row']['status'];

interface StatusIndicatorProps {
  status: ProjectStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

const statusConfig = {
  pending: {
    icon: Clock,
    color: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Pending',
    description: 'Waiting to start processing'
  },
  processing: {
    icon: RefreshCw,
    color: 'bg-blue-500',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Processing',
    description: 'Converting workflow to code'
  },
  completed: {
    icon: CheckCircle,
    color: 'bg-green-500',
    textColor: 'text-green-700',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Completed',
    description: 'Successfully converted'
  },
  failed: {
    icon: XCircle,
    color: 'bg-red-500',
    textColor: 'text-red-700',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Failed',
    description: 'Conversion failed'
  }
};

const sizeConfig = {
  sm: {
    iconSize: 'h-3 w-3',
    textSize: 'text-xs',
    padding: 'px-2 py-1'
  },
  md: {
    iconSize: 'h-4 w-4',
    textSize: 'text-sm',
    padding: 'px-3 py-1.5'
  },
  lg: {
    iconSize: 'h-5 w-5',
    textSize: 'text-base',
    padding: 'px-4 py-2'
  }
};

export function StatusIndicator({ 
  status, 
  size = 'md',
  showIcon = true,
  showLabel = true,
  animated = true,
  className = ''
}: StatusIndicatorProps) {
  const config = statusConfig[status];
  const sizeConf = sizeConfig[size];
  const StatusIcon = config.icon;

  const shouldAnimate = animated && status === 'processing';

  return (
    <Badge 
      variant="secondary" 
      className={`
        ${config.bgColor} 
        ${config.textColor} 
        ${config.borderColor}
        ${sizeConf.textSize}
        ${sizeConf.padding}
        border
        ${className}
      `}
    >
      <div className="flex items-center gap-1.5">
        {showIcon && (
          <StatusIcon 
            className={`
              ${sizeConf.iconSize} 
              ${shouldAnimate ? 'animate-spin' : ''}
            `} 
          />
        )}
        {showLabel && config.label}
      </div>
    </Badge>
  );
}

interface StatusIndicatorWithDescriptionProps extends StatusIndicatorProps {
  showDescription?: boolean;
}

export function StatusIndicatorWithDescription({ 
  status,
  size = 'md',
  showIcon = true,
  showLabel = true,
  showDescription = true,
  animated = true,
  className = ''
}: StatusIndicatorWithDescriptionProps) {
  const config = statusConfig[status];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <StatusIndicator 
        status={status}
        size={size}
        showIcon={showIcon}
        showLabel={showLabel}
        animated={animated}
      />
      {showDescription && (
        <span className="text-sm text-gray-600">
          {config.description}
        </span>
      )}
    </div>
  );
}

interface StatusTimelineProps {
  currentStatus: ProjectStatus;
  timestamps?: {
    pending?: string;
    processing?: string;
    completed?: string;
    failed?: string;
  };
  className?: string;
}

export function StatusTimeline({ 
  currentStatus, 
  timestamps = {},
  className = ''
}: StatusTimelineProps) {
  const statuses: ProjectStatus[] = ['pending', 'processing', 'completed'];
  
  // If failed, show the failure path
  if (currentStatus === 'failed') {
    const failedIndex = statuses.findIndex(s => timestamps[s]);
    statuses.splice(failedIndex + 1, statuses.length - failedIndex - 1, 'failed');
  }

  const getCurrentStatusIndex = () => {
    return statuses.indexOf(currentStatus);
  };

  const currentIndex = getCurrentStatusIndex();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {statuses.map((status, index) => {
        const config = statusConfig[status];
        const StatusIcon = config.icon;
        const isActive = index <= currentIndex;
        const isCurrent = index === currentIndex;
        const timestamp = timestamps[status];

        return (
          <React.Fragment key={status}>
            <div className="flex flex-col items-center gap-1">
              <div 
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2
                  ${isActive 
                    ? `${config.color} border-transparent text-white` 
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                  }
                `}
              >
                <StatusIcon 
                  className={`
                    h-4 w-4 
                    ${isCurrent && status === 'processing' ? 'animate-spin' : ''}
                  `} 
                />
              </div>
              <div className="text-center">
                <div className={`text-xs font-medium ${isActive ? config.textColor : 'text-gray-400'}`}>
                  {config.label}
                </div>
                {timestamp && (
                  <div className="text-xs text-gray-500">
                    {new Date(timestamp).toLocaleTimeString()}
                  </div>
                )}
              </div>
            </div>
            
            {index < statuses.length - 1 && (
              <div 
                className={`
                  flex-1 h-0.5 mx-2
                  ${index < currentIndex ? config.color : 'bg-gray-200'}
                `}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}