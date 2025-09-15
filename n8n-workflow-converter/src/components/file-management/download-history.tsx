'use client';

import React, { useEffect, useState } from 'react';
import { 
  Download, 
  Trash2, 
  Calendar, 
  FileArchive, 
  Package, 
  Files, 
  ExternalLink,
  RefreshCw,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDownloadHistory } from '@/hooks/use-download';
import { ExportFormat, DownloadHistoryEntry } from '@/lib/services/download-service';

interface DownloadHistoryProps {
  className?: string;
  limit?: number;
}

const formatIcons = {
  zip: FileArchive,
  'tar.gz': Package,
  individual: Files
};

export function DownloadHistory({ className = '', limit = 50 }: DownloadHistoryProps) {
  const [filter, setFilter] = useState<'all' | ExportFormat>('all');
  const [sortBy, setSortBy] = useState<'date' | 'size' | 'name'>('date');

  const {
    history,
    isLoading,
    error,
    fetchHistory,
    clearHistory,
    deleteHistoryEntry
  } = useDownloadHistory();

  useEffect(() => {
    fetchHistory(limit);
  }, [fetchHistory, limit]);

  const handleRefresh = () => {
    fetchHistory(limit);
  };

  const handleClearAll = async () => {
    if (window.confirm('Are you sure you want to clear all download history?')) {
      try {
        await clearHistory();
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  const handleClearOld = async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    if (window.confirm('Clear download history older than 30 days?')) {
      try {
        await clearHistory(thirtyDaysAgo);
      } catch (error) {
        console.error('Failed to clear old history:', error);
      }
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    if (window.confirm('Delete this download history entry?')) {
      try {
        await deleteHistoryEntry(entryId);
      } catch (error) {
        console.error('Failed to delete entry:', error);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Filter and sort history
  const filteredHistory = history
    .filter(entry => filter === 'all' || entry.format === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return b.downloadedAt.getTime() - a.downloadedAt.getTime();
        case 'size':
          return b.fileSize - a.fileSize;
        case 'name':
          return a.fileName.localeCompare(b.fileName);
        default:
          return 0;
      }
    });

  const totalSize = history.reduce((sum, entry) => sum + entry.fileSize, 0);
  const totalDownloads = history.length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Download History
            </CardTitle>
            <CardDescription>
              Track your project downloads and manage storage
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{totalDownloads}</div>
            <div className="text-sm text-gray-500">Total Downloads</div>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{formatFileSize(totalSize)}</div>
            <div className="text-sm text-gray-500">Total Size</div>
          </div>
        </div>

        {/* Filters and Controls */}
        <div className="flex flex-wrap gap-2 items-center justify-between">
          <div className="flex gap-2">
            <Select value={filter} onValueChange={(value: any) => setFilter(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Formats</SelectItem>
                <SelectItem value="zip">ZIP</SelectItem>
                <SelectItem value="tar.gz">TAR.GZ</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">By Date</SelectItem>
                <SelectItem value="size">By Size</SelectItem>
                <SelectItem value="name">By Name</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearOld}
              disabled={isLoading}
            >
              Clear Old
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearAll}
              disabled={isLoading || history.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* History List */}
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">Loading download history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <Download className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">
              {filter === 'all' ? 'No downloads yet' : `No ${filter} downloads found`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredHistory.map((entry, index) => {
              const Icon = formatIcons[entry.format];
              const isExpired = entry.expiresAt && entry.expiresAt < new Date();
              
              return (
                <div key={entry.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Icon className="h-5 w-5 mt-0.5 text-gray-500" />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{entry.fileName}</h4>
                          <Badge variant="secondary" className="text-xs">
                            {entry.format.toUpperCase()}
                          </Badge>
                          {isExpired && (
                            <Badge variant="destructive" className="text-xs">
                              Expired
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-500 space-y-1">
                          <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(entry.downloadedAt)}
                            </span>
                            <span>{formatFileSize(entry.fileSize)}</span>
                          </div>
                          
                          {(entry as any).project && (
                            <div className="text-xs">
                              Project: {(entry as any).project.name}
                            </div>
                          )}
                          
                          <div className="text-xs">
                            Format: {entry.format === 'individual' ? 'Individual Files' : entry.format.toUpperCase()}
                          </div>
                          
                          {entry.expiresAt && (
                            <div className="text-xs">
                              {isExpired ? 'Expired' : 'Expires'}: {formatDate(entry.expiresAt)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      {!isExpired && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.open(`/api/projects/${entry.projectId}/download?format=${entry.format}`, '_blank')}
                          disabled={isLoading}
                          title="Re-download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={isLoading}
                        title="Delete from history"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More */}
        {filteredHistory.length >= limit && (
          <div className="text-center">
            <Button
              variant="outline"
              onClick={() => fetchHistory(limit + 25)}
              disabled={isLoading}
            >
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DownloadHistory;