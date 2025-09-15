'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Upload, 
  FileText, 
  Download, 
  Share,
  Settings,
  HelpCircle
} from 'lucide-react';

interface QuickActionsProps {
  onUploadWorkflow: () => void;
  onViewDocumentation: () => void;
  onDownloadTemplate: () => void;
  onShareProject: () => void;
  onOpenSettings: () => void;
  onGetHelp: () => void;
}

export function QuickActions({
  onUploadWorkflow,
  onViewDocumentation,
  onDownloadTemplate,
  onShareProject,
  onOpenSettings,
  onGetHelp
}: QuickActionsProps) {
  const actions = [
    {
      title: 'Upload Workflow',
      description: 'Convert n8n JSON to Node.js',
      icon: <Upload className="h-5 w-5" />,
      onClick: onUploadWorkflow,
      primary: true
    },
    {
      title: 'Documentation',
      description: 'Learn how to use the converter',
      icon: <FileText className="h-5 w-5" />,
      onClick: onViewDocumentation,
      primary: false
    },
    {
      title: 'Download Template',
      description: 'Get sample workflow files',
      icon: <Download className="h-5 w-5" />,
      onClick: onDownloadTemplate,
      primary: false
    },
    {
      title: 'Share Project',
      description: 'Collaborate with team members',
      icon: <Share className="h-5 w-5" />,
      onClick: onShareProject,
      primary: false
    },
    {
      title: 'Settings',
      description: 'Configure your preferences',
      icon: <Settings className="h-5 w-5" />,
      onClick: onOpenSettings,
      primary: false
    },
    {
      title: 'Get Help',
      description: 'Support and tutorials',
      icon: <HelpCircle className="h-5 w-5" />,
      onClick: onGetHelp,
      primary: false
    }
  ];

  return (
    <Card className="p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.primary ? 'default' : 'outline'}
            className="h-auto p-4 flex flex-col items-start text-left"
            onClick={action.onClick}
          >
            <div className="flex items-center gap-3 mb-2">
              {action.icon}
              <span className="font-medium">{action.title}</span>
            </div>
            <span className="text-sm opacity-75">{action.description}</span>
          </Button>
        ))}
      </div>
    </Card>
  );
}