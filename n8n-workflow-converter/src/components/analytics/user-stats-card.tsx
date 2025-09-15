'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';

interface UserStatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
    period: string;
  };
  className?: string;
}

export function UserStatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  className
}: UserStatsCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;
    
    switch (trend.direction) {
      case 'up':
        return <TrendingUp className="h-3 w-3" />;
      case 'down':
        return <TrendingDown className="h-3 w-3" />;
      default:
        return <Minus className="h-3 w-3" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'secondary';
    
    switch (trend.direction) {
      case 'up':
        return 'default'; // Green
      case 'down':
        return 'destructive'; // Red
      default:
        return 'secondary'; // Gray
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="text-2xl font-bold">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          
          <div className="flex items-center justify-between">
            {description && (
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
            )}
            
            {trend && (
              <Badge 
                variant={getTrendColor()}
                className="flex items-center gap-1 text-xs"
              >
                {getTrendIcon()}
                {trend.percentage}% {trend.period}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default UserStatsCard;