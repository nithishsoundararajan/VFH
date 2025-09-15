'use client';

import React, { useState } from 'react';
import { Download, FileArchive, Package, Files, Settings, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import useDownload, { DownloadOptions } from '@/hooks/use-download';
import { ExportFormat } from '@/lib/services/download-service';

interface ProjectDownloadProps {
  projectId: string;
  projectName: string;
  projectStatus: 'pending' | 'processing' | 'completed' | 'failed';
  className?: string;
}

const formatIcons = {
  zip: FileArchive,
  'tar.gz': Package,
  individual: Files
};

const formatDescriptions = {
  zip: 'Complete project as a ZIP archive (recommended)',
  'tar.gz': 'Complete project as a compressed tar.gz archive',
  individual: 'Download individual project files separately'
};

export function ProjectDownload({
  projectId,
  projectName,
  projectStatus,
  className = ''
}: ProjectDownloadProps) {
  const [options, setOptions] = useState<DownloadOptions>({
    format: 'zip',
    includeSource: true,
    includeDocs: true,
    includeTests: false
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const {
    isDownloading,
    progress,
    error,
    downloadUrl,
    downloadProject,
    generateDownloadLink,
    resetState
  } = useDownload();

  const handleDownload = async () => {
    try {
      resetState();
      await downloadProject(projectId, options);
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleGenerateLink = async () => {
    try {
      const link = await generateDownloadLink(projectId, options.format, 3600);
      // You could show the link in a modal or copy to clipboard
      navigator.clipboard.writeText(link.url);
      alert('Download link copied to clipboard!');
    } catch (error) {
      console.error('Link generation failed:', error);
    }
  };

  const isProjectReady = projectStatus === 'completed';
  const isProjectProcessing = projectStatus === 'processing';

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          Download Project
        </CardTitle>
        <CardDescription>
          Export your generated project in various formats
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Project Status */}
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">{projectName}</h4>
            <p className="text-sm text-gray-500">Project ID: {projectId}</p>
          </div>
          <Badge 
            variant={
              projectStatus === 'completed' ? 'default' :
              projectStatus === 'processing' ? 'secondary' :
              projectStatus === 'failed' ? 'destructive' : 'outline'
            }
          >
            {projectStatus}
          </Badge>
        </div>

        {/* Status Messages */}
        {!isProjectReady && !isProjectProcessing && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Project is not ready for download. Please wait for generation to complete.
            </AlertDescription>
          </Alert>
        )}

        {isProjectProcessing && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertDescription>
              Project is currently being generated. Download will be available once complete.
            </AlertDescription>
          </Alert>
        )}

        {/* Export Format Selection */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Export Format</label>
          <Select
            value={options.format}
            onValueChange={(value: ExportFormat) => 
              setOptions(prev => ({ ...prev, format: value }))
            }
            disabled={!isProjectReady || isDownloading}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(formatDescriptions).map(([format, description]) => {
                const Icon = formatIcons[format as ExportFormat];
                return (
                  <SelectItem key={format} value={format}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <div>
                        <div className="font-medium">{format.toUpperCase()}</div>
                        <div className="text-xs text-gray-500">{description}</div>
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Options */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="p-0 h-auto font-normal text-sm"
          >
            <Settings className="h-4 w-4 mr-1" />
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options
          </Button>

          {showAdvanced && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">Include in Export</label>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeSource"
                      checked={options.includeSource}
                      onCheckedChange={(checked) =>
                        setOptions(prev => ({ ...prev, includeSource: !!checked }))
                      }
                      disabled={!isProjectReady || isDownloading}
                    />
                    <label htmlFor="includeSource" className="text-sm">
                      Source code files
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeDocs"
                      checked={options.includeDocs}
                      onCheckedChange={(checked) =>
                        setOptions(prev => ({ ...prev, includeDocs: !!checked }))
                      }
                      disabled={!isProjectReady || isDownloading}
                    />
                    <label htmlFor="includeDocs" className="text-sm">
                      Documentation (README, setup guides)
                    </label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="includeTests"
                      checked={options.includeTests}
                      onCheckedChange={(checked) =>
                        setOptions(prev => ({ ...prev, includeTests: !!checked }))
                      }
                      disabled={!isProjectReady || isDownloading}
                    />
                    <label htmlFor="includeTests" className="text-sm">
                      Test files and configurations
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Download Progress */}
        {isDownloading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Preparing download...</span>
              <span className="text-sm text-gray-500">{progress}%</span>
            </div>
            <Progress value={progress} className="w-full" />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Success Display */}
        {downloadUrl && !isDownloading && (
          <Alert>
            <AlertDescription className="flex items-center justify-between">
              <span>Download completed successfully!</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(downloadUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleDownload}
            disabled={!isProjectReady || isDownloading}
            className="flex-1"
          >
            <Download className="mr-2 h-4 w-4" />
            {isDownloading ? 'Downloading...' : 'Download Now'}
          </Button>

          {options.format === 'individual' ? (
            <Button
              variant="outline"
              onClick={() => window.open(`/api/projects/${projectId}/files`, '_blank')}
              disabled={!isProjectReady || isDownloading}
            >
              <Files className="h-4 w-4 mr-1" />
              Browse Files
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={handleGenerateLink}
              disabled={!isProjectReady || isDownloading}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Format Info */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• ZIP files are compatible with all operating systems</p>
          <p>• Individual files allow selective downloading</p>
          <p>• Generated links expire after 1 hour for security</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default ProjectDownload;