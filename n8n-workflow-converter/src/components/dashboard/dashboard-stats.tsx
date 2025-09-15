'use client';

import { Card } from '@/components/ui/card';
import { Database } from '@/types/database';
import { 
  FileText, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  Zap
} from 'lucide-react';

type Project = Database['public']['Tables']['projects']['Row'];
type ProjectAnalytics = Database['public']['Tables']['project_analytics']['Row'];

interface DashboardStatsProps {
  projects: Project[];
  analytics?: ProjectAnalytics[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function StatCard({ title, value, icon, description, trend }: StatCardProps) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {description && (
            <p className="text-sm text-gray-500 mt-1">{description}</p>
          )}
        </div>
        <div className="h-12 w-12 bg-blue-50 rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className="mt-4 flex items-center">
          <TrendingUp className={`h-4 w-4 mr-1 ${
            trend.isPositive ? 'text-green-500' : 'text-red-500'
          }`} />
          <span className={`text-sm font-medium ${
            trend.isPositive ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.isPositive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-sm text-gray-500 ml-1">from last month</span>
        </div>
      )}
    </Card>
  );
}

export function DashboardStats({ projects, analytics = [] }: DashboardStatsProps) {
  const totalProjects = projects.length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;
  const processingProjects = projects.filter(p => p.status === 'processing').length;
  const failedProjects = projects.filter(p => p.status === 'failed').length;
  
  const totalNodes = projects.reduce((sum, project) => sum + (project.node_count || 0), 0);
  const totalTriggers = projects.reduce((sum, project) => sum + (project.trigger_count || 0), 0);
  
  const avgGenerationTime = analytics.length > 0 
    ? Math.round(analytics.reduce((sum, a) => sum + (a.generation_time_ms || 0), 0) / analytics.length / 1000)
    : 0;

  const successRate = totalProjects > 0 
    ? Math.round((completedProjects / totalProjects) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <StatCard
        title="Total Projects"
        value={totalProjects}
        icon={<FileText className="h-6 w-6 text-blue-600" />}
        description={`${completedProjects} completed`}
      />
      
      <StatCard
        title="Success Rate"
        value={`${successRate}%`}
        icon={<CheckCircle className="h-6 w-6 text-green-600" />}
        description={`${completedProjects}/${totalProjects} successful`}
      />
      
      <StatCard
        title="Processing"
        value={processingProjects}
        icon={<Clock className="h-6 w-6 text-yellow-600" />}
        description={failedProjects > 0 ? `${failedProjects} failed` : 'All running smoothly'}
      />
      
      <StatCard
        title="Total Nodes"
        value={totalNodes}
        icon={<Zap className="h-6 w-6 text-purple-600" />}
        description={`${totalTriggers} triggers`}
      />
    </div>
  );
}