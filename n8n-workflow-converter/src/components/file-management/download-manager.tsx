'use client';

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, History, Files, Archive } from 'lucide-react';
import ProjectDownload from './project-download';
import DownloadHistory from './download-history';
import IndividualFileBrowser from './individual-file-browser';

interface DownloadManagerProps {
  projectId?: string;
  projectName?: string;
  projectStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  className?: string;
}

export function DownloadManager({
  projectId,
  projectName,
  projectStatus,
  className = ''
}: DownloadManagerProps) {
  const [activeTab, setActiveTab] = useState('download');

  return (
    <div className={className}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="download" className="flex items-center gap-2">
            <Download className="h-4 w-4" />
            Download Project
          </TabsTrigger>
          <TabsTrigger value="files" className="flex items-center gap-2" disabled={!projectId}>
            <Files className="h-4 w-4" />
            Browse Files
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Download History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="download" className="mt-6">
          {projectId && projectName && projectStatus ? (
            <ProjectDownload
              projectId={projectId}
              projectName={projectName}
              projectStatus={projectStatus}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Archive className="h-5 w-5" />
                  Project Download
                </CardTitle>
                <CardDescription>
                  Select a project to download
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  No project selected. Please select a project from your dashboard to download.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="files" className="mt-6">
          {projectId && projectName ? (
            <IndividualFileBrowser
              projectId={projectId}
              projectName={projectName}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Files className="h-5 w-5" />
                  Individual Files
                </CardTitle>
                <CardDescription>
                  Browse and download individual project files
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  No project selected. Please select a project from your dashboard to browse files.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <DownloadHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DownloadManager;