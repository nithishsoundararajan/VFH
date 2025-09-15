'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  File, 
  Folder, 
  Eye, 
  Copy, 
  RefreshCw,
  Search,
  Filter,
  SortAsc,
  SortDesc,
  Calendar,
  HardDrive
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

interface ProjectFile {
  name: string;
  url: string;
  size: number;
  expiresAt: Date;
}

interface IndividualFileBrowserProps {
  projectId: string;
  projectName: string;
  className?: string;
}

export function IndividualFileBrowser({
  projectId,
  projectName,
  className = ''
}: IndividualFileBrowserProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [filteredFiles, setFilteredFiles] = useState<ProjectFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'type'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [includeSource, setIncludeSource] = useState(true);
  const [includeDocs, setIncludeDocs] = useState(true);
  const [includeTests, setIncludeTests] = useState(false);

  const fetchFiles = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        includeSource: includeSource.toString(),
        includeDocs: includeDocs.toString(),
        includeTests: includeTests.toString()
      });

      const response = await fetch(`/api/projects/${projectId}/files?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch files');
      }

      const data = await response.json();

      if (!data.success || !data.files) {
        throw new Error('Invalid response format');
      }

      const projectFiles: ProjectFile[] = data.files.map((file: any) => ({
        name: file.name,
        url: file.url,
        size: file.size,
        expiresAt: new Date(file.expiresAt)
      }));

      setFiles(projectFiles);
      setFilteredFiles(projectFiles);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      setFiles([]);
      setFilteredFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [projectId, includeSource, includeDocs, includeTests]);

  useEffect(() => {
    // Filter and sort files
    let filtered = files.filter(file =>
      file.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort files
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = a.size - b.size;
          break;
        case 'type':
          const aExt = a.name.split('.').pop() || '';
          const bExt = b.name.split('.').pop() || '';
          comparison = aExt.localeCompare(bExt);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredFiles(filtered);
  }, [files, searchTerm, sortBy, sortOrder]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    switch (ext) {
      case 'js':
      case 'ts':
      case 'json':
        return '📄';
      case 'md':
        return '📝';
      case 'zip':
      case 'tar':
      case 'gz':
        return '📦';
      default:
        return '📄';
    }
  };

  const handleDownloadFile = async (file: ProjectFile) => {
    try {
      // Create a temporary link and trigger download
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Download failed:', error);
      setError('Failed to download file');
    }
  };

  const handleCopyUrl = async (file: ProjectFile) => {
    try {
      await navigator.clipboard.writeText(file.url);
      // You could show a toast notification here
      alert('Download URL copied to clipboard!');
    } catch (error) {
      console.error('Copy failed:', error);
      setError('Failed to copy URL');
    }
  };

  const handleSelectFile = (fileName: string, selected: boolean) => {
    const newSelected = new Set(selectedFiles);
    if (selected) {
      newSelected.add(fileName);
    } else {
      newSelected.delete(fileName);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedFiles(new Set(filteredFiles.map(f => f.name)));
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleDownloadSelected = async () => {
    const selectedFileObjects = filteredFiles.filter(f => selectedFiles.has(f.name));
    
    for (const file of selectedFileObjects) {
      await handleDownloadFile(file);
      // Add a small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const totalSize = filteredFiles.reduce((sum, file) => sum + file.size, 0);
  const selectedSize = filteredFiles
    .filter(f => selectedFiles.has(f.name))
    .reduce((sum, file) => sum + file.size, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Folder className="h-5 w-5" />
              Project Files
            </CardTitle>
            <CardDescription>
              Browse and download individual files from {projectName}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFiles}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Type Filters */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Include File Types</label>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeSource"
                checked={includeSource}
                onCheckedChange={setIncludeSource}
              />
              <label htmlFor="includeSource" className="text-sm">
                Source Code (.js, .ts)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDocs"
                checked={includeDocs}
                onCheckedChange={setIncludeDocs}
              />
              <label htmlFor="includeDocs" className="text-sm">
                Documentation (.md)
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeTests"
                checked={includeTests}
                onCheckedChange={setIncludeTests}
              />
              <label htmlFor="includeTests" className="text-sm">
                Test Files
              </label>
            </div>
          </div>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex-1 min-w-48">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="size">Size</SelectItem>
              <SelectItem value="type">Type</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
          </Button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-blue-600">{filteredFiles.length}</div>
            <div className="text-xs text-gray-500">Files</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-green-600">{formatFileSize(totalSize)}</div>
            <div className="text-xs text-gray-500">Total Size</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-lg font-bold text-purple-600">{selectedFiles.size}</div>
            <div className="text-xs text-gray-500">Selected</div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Bulk Actions */}
        {selectedFiles.size > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <span className="text-sm">
              {selectedFiles.size} files selected ({formatFileSize(selectedSize)})
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFiles(new Set())}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={handleDownloadSelected}
              >
                <Download className="h-4 w-4 mr-1" />
                Download Selected
              </Button>
            </div>
          </div>
        )}

        {/* File List */}
        {isLoading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">Loading files...</p>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="text-center py-8">
            <File className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p className="text-gray-500">
              {searchTerm ? 'No files match your search' : 'No files found'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Select All */}
            <div className="flex items-center space-x-2 p-2 border-b">
              <Checkbox
                checked={selectedFiles.size === filteredFiles.length && filteredFiles.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">Select All</span>
            </div>

            {/* File Items */}
            {filteredFiles.map((file) => (
              <div key={file.name} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50">
                <Checkbox
                  checked={selectedFiles.has(file.name)}
                  onCheckedChange={(checked) => handleSelectFile(file.name, !!checked)}
                />
                
                <div className="text-lg">{getFileIcon(file.name)}</div>
                
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{file.name}</div>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(file.size)}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyUrl(file)}
                    title="Copy download URL"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadFile(file)}
                    title="Download file"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default IndividualFileBrowser;