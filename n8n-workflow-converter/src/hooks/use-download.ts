import { useState, useCallback } from 'react';
import { ExportFormat, DownloadHistoryEntry } from '@/lib/services/download-service';

export interface DownloadOptions {
  format: ExportFormat;
  includeSource?: boolean;
  includeDocs?: boolean;
  includeTests?: boolean;
}

export interface DownloadState {
  isDownloading: boolean;
  progress: number;
  error: string | null;
  downloadUrl: string | null;
}

export interface DownloadHistoryState {
  history: DownloadHistoryEntry[];
  isLoading: boolean;
  error: string | null;
}

export function useDownload() {
  const [state, setState] = useState<DownloadState>({
    isDownloading: false,
    progress: 0,
    error: null,
    downloadUrl: null
  });

  const [individualFiles, setIndividualFiles] = useState<Array<{
    name: string;
    url: string;
    size: number;
    expiresAt: Date;
  }>>([]);

  const downloadProject = useCallback(async (
    projectId: string,
    options: DownloadOptions = { format: 'zip' }
  ) => {
    setState({
      isDownloading: true,
      progress: 0,
      error: null,
      downloadUrl: null
    });

    try {
      // Build query parameters
      const params = new URLSearchParams({
        format: options.format,
        includeSource: options.includeSource?.toString() || 'false',
        includeDocs: options.includeDocs?.toString() || 'false',
        includeTests: options.includeTests?.toString() || 'false'
      });

      setState(prev => ({ ...prev, progress: 25 }));

      const response = await fetch(`/api/projects/${projectId}/download?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setState(prev => ({ ...prev, progress: 50 }));

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Download failed');
      }

      const data = await response.json();

      setState(prev => ({ ...prev, progress: 75 }));

      if (!data.success || !data.download) {
        throw new Error('Invalid download response');
      }

      setState(prev => ({ ...prev, progress: 100 }));

      // Trigger browser download
      const downloadUrl = data.download.url;
      const fileName = data.download.fileName;

      // Create a temporary link and click it
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setState({
        isDownloading: false,
        progress: 100,
        error: null,
        downloadUrl
      });

      return { success: true, fileName, url: downloadUrl };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown download error';
      setState({
        isDownloading: false,
        progress: 0,
        error: errorMessage,
        downloadUrl: null
      });
      throw error;
    }
  }, []);

  const generateDownloadLink = useCallback(async (
    projectId: string,
    format: ExportFormat = 'zip',
    expiresIn = 3600
  ) => {
    setState(prev => ({ ...prev, isDownloading: true, error: null }));

    try {
      const response = await fetch(`/api/projects/${projectId}/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ format, expiresIn })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate download link');
      }

      const data = await response.json();

      if (!data.success || !data.link) {
        throw new Error('Invalid link generation response');
      }

      setState(prev => ({
        ...prev,
        isDownloading: false,
        downloadUrl: data.link.url
      }));

      return {
        url: data.link.url,
        expiresAt: new Date(data.link.expiresAt)
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isDownloading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const getIndividualFiles = useCallback(async (
    projectId: string,
    options: { includeSource?: boolean; includeDocs?: boolean; includeTests?: boolean } = {}
  ) => {
    setState(prev => ({ ...prev, isDownloading: true, error: null }));

    try {
      const params = new URLSearchParams({
        includeSource: options.includeSource?.toString() || 'true',
        includeDocs: options.includeDocs?.toString() || 'true',
        includeTests: options.includeTests?.toString() || 'false'
      });

      const response = await fetch(`/api/projects/${projectId}/files?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch individual files');
      }

      const data = await response.json();

      if (!data.success || !data.files) {
        throw new Error('Invalid response format');
      }

      const files = data.files.map((file: any) => ({
        name: file.name,
        url: file.url,
        size: file.size,
        expiresAt: new Date(file.expiresAt)
      }));

      setIndividualFiles(files);
      setState(prev => ({ ...prev, isDownloading: false }));

      return files;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isDownloading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const downloadIndividualFile = useCallback(async (
    projectId: string,
    fileName: string
  ) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${encodeURIComponent(fileName)}?direct=true`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download file');
      }

      // The API will redirect to the signed URL for direct download
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  const resetState = useCallback(() => {
    setState({
      isDownloading: false,
      progress: 0,
      error: null,
      downloadUrl: null
    });
    setIndividualFiles([]);
  }, []);

  return {
    ...state,
    individualFiles,
    downloadProject,
    generateDownloadLink,
    getIndividualFiles,
    downloadIndividualFile,
    resetState
  };
}

export function useDownloadHistory() {
  const [state, setState] = useState<DownloadHistoryState>({
    history: [],
    isLoading: false,
    error: null
  });

  const fetchHistory = useCallback(async (limit = 50, offset = 0) => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      });

      const response = await fetch(`/api/downloads/history?${params}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch download history');
      }

      const data = await response.json();

      setState({
        history: data.history || [],
        isLoading: false,
        error: null
      });

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  const clearHistory = useCallback(async (olderThan?: Date) => {
    try {
      const params = new URLSearchParams();
      if (olderThan) {
        params.set('olderThan', olderThan.toISOString());
      }

      const response = await fetch(`/api/downloads/history?${params}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to clear download history');
      }

      const data = await response.json();

      // Refresh history after clearing
      await fetchHistory();

      return data;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [fetchHistory]);

  const deleteHistoryEntry = useCallback(async (entryId: string) => {
    try {
      const response = await fetch(`/api/downloads/history?id=${entryId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete download history entry');
      }

      // Remove entry from local state
      setState(prev => ({
        ...prev,
        history: prev.history.filter(entry => entry.id !== entryId)
      }));

      return await response.json();

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, []);

  return {
    ...state,
    fetchHistory,
    clearHistory,
    deleteHistoryEntry
  };
}

export default useDownload;