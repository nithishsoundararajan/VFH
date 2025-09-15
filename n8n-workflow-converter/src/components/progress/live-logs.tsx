'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRealtimeLogs } from '@/hooks/use-realtime-logs';
import { Database } from '@/types/database';
import { 
  Search,
  Filter,
  Download,
  Trash2,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  XCircle,
  Info,
  WifiOff,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react';

type GenerationLog = Database['public']['Tables']['generation_logs']['Row'];
type LogLevel = GenerationLog['log_level'];

interface LiveLogsProps {
  projectId: string;
  maxHeight?: string;
  showFilters?: boolean;
  showControls?: boolean;
  autoScroll?: boolean;
  className?: string;
}

const logLevelConfig = {
  info: {
    icon: Info,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    label: 'Info'
  },
  warning: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    label: 'Warning'
  },
  error: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'Error'
  }
};

export function LiveLogs({
  projectId,
  maxHeight = '400px',
  showFilters = true,
  showControls = true,
  autoScroll: initialAutoScroll = true,
  className = ''
}: LiveLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(initialAutoScroll);
  const [isExpanded, setIsExpanded] = useState(true);
  const [copiedLogId, setCopiedLogId] = useState<string | null>(null);
  
  const logContainerRef = useRef<HTMLDivElement>(null);

  const {
    logs,
    filteredLogs,
    isConnected,
    connectionError,
    setLogFilter,
    reconnect
  } = useRealtimeLogs({
    projectId,
    autoScroll: isAutoScrollEnabled,
    maxLogs: 1000,
    onNewLog: (log) => {
      console.log('New log received:', log);
    },
    onError: (error) => {
      console.error('Live logs error:', error);
    }
  });

  // Update filter when search term or level changes
  useEffect(() => {
    setLogFilter({
      level: selectedLevel === 'all' ? undefined : selectedLevel,
      search: searchTerm.trim() || undefined
    });
  }, [searchTerm, selectedLevel, setLogFilter]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (isAutoScrollEnabled && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, isAutoScrollEnabled]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getLogIcon = (level: LogLevel) => {
    const config = logLevelConfig[level];
    const IconComponent = config.icon;
    return <IconComponent className={`h-4 w-4 ${config.color}`} />;
  };

  const getLogLevelCounts = () => {
    const counts = logs.reduce((acc, log) => {
      acc[log.log_level] = (acc[log.log_level] || 0) + 1;
      return acc;
    }, {} as Record<LogLevel, number>);
    
    return {
      total: logs.length,
      info: counts.info || 0,
      warning: counts.warning || 0,
      error: counts.error || 0
    };
  };

  const copyLogToClipboard = async (log: GenerationLog) => {
    const logText = `[${formatTimestamp(log.timestamp)}] ${log.log_level.toUpperCase()}: ${log.message}`;
    
    try {
      await navigator.clipboard.writeText(logText);
      setCopiedLogId(log.id);
      setTimeout(() => setCopiedLogId(null), 2000);
    } catch (error) {
      console.error('Failed to copy log:', error);
    }
  };

  const exportLogs = () => {
    const logsText = filteredLogs
      .map(log => `[${formatTimestamp(log.timestamp)}] ${log.log_level.toUpperCase()}: ${log.message}`)
      .join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `project-${projectId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  const scrollToTop = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  };

  const counts = getLogLevelCounts();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              Live Logs
              {!isConnected && <WifiOff className="h-4 w-4 text-red-500" />}
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs">
                {filteredLogs.length} / {counts.total}
              </Badge>
              {counts.error > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {counts.error} errors
                </Badge>
              )}
              {counts.warning > 0 && (
                <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                  {counts.warning} warnings
                </Badge>
              )}
            </div>
          </CardTitle>
          
          {showControls && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
                className={isAutoScrollEnabled ? 'text-blue-600' : ''}
              >
                {isAutoScrollEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={exportLogs}
                disabled={filteredLogs.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        
        {/* Connection Error Alert */}
        {connectionError && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{connectionError}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={reconnect}
                className="ml-2"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reconnect
              </Button>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Filters */}
        {showFilters && isExpanded && (
          <div className="flex items-center gap-2 mt-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            <Select value={selectedLevel} onValueChange={(value) => setSelectedLevel(value as LogLevel | 'all')}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info ({counts.info})</SelectItem>
                <SelectItem value="warning">Warning ({counts.warning})</SelectItem>
                <SelectItem value="error">Error ({counts.error})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </CardHeader>
      
      {isExpanded && (
        <CardContent>
          <div 
            ref={logContainerRef}
            className="bg-gray-50 rounded-md p-3 font-mono text-xs overflow-y-auto border"
            style={{ maxHeight }}
          >
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {logs.length === 0 ? (
                  <div>
                    <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No logs yet.</p>
                    <p className="text-xs mt-1">Logs will appear here in real-time.</p>
                  </div>
                ) : (
                  <div>
                    <Filter className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                    <p>No logs match your filters.</p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedLevel('all');
                      }}
                      className="mt-2"
                    >
                      Clear Filters
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {filteredLogs.map((log, index) => (
                  <div 
                    key={log.id}
                    className="group flex items-start gap-2 py-1 px-2 rounded hover:bg-white/50 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {getLogIcon(log.log_level)}
                      <span className="text-gray-500 font-mono text-xs min-w-[80px]">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`text-xs px-1 py-0 ${logLevelConfig[log.log_level].bgColor} ${logLevelConfig[log.log_level].color} border-0`}
                      >
                        {log.log_level.toUpperCase()}
                      </Badge>
                      <span className="text-gray-700 break-words flex-1">
                        {log.message}
                      </span>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyLogToClipboard(log)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
                    >
                      {copiedLogId === log.id ? (
                        <CheckCircle className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Scroll Controls */}
          {filteredLogs.length > 0 && (
            <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={scrollToTop}
                  className="h-6 px-2 text-xs"
                >
                  Top
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={scrollToBottom}
                  className="h-6 px-2 text-xs"
                >
                  Bottom
                </Button>
              </div>
              
              <div className="flex items-center gap-2">
                <span>
                  Showing {filteredLogs.length} of {counts.total} logs
                </span>
                {!isConnected && (
                  <span className="text-red-500">• Disconnected</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}