/**
 * Shared types for Supabase Edge Functions
 */

export interface WorkflowNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters?: Record<string, any>
  credentials?: Record<string, string>
}

export interface WorkflowConnection {
  node: string
  type: string
  index: number
}

export interface WorkflowData {
  name?: string
  nodes: WorkflowNode[]
  connections: Record<string, Record<string, WorkflowConnection[]>>
  createdAt?: string
  updatedAt?: string
  settings?: Record<string, any>
}

export interface MappedNode {
  id: string
  name: string
  type: string
  packageName: string
  importPath: string
  supported: boolean
  parameters: Record<string, any>
  credentialTypes: string[]
  executionCode: string
  errorMessage?: string
}

export interface SecurityScanResult {
  safe: boolean
  scanId?: string
  permalink?: string
  message: string
  positives?: number
  total?: number
}

export interface WorkflowMetadata {
  name: string
  nodeCount: number
  triggerCount: number
  connections: number
  nodeTypes: string[]
  hasCredentials: boolean
}

export interface GeneratedFile {
  path: string
  content: string
  type: 'javascript' | 'json' | 'markdown' | 'text'
}

export interface ProjectAnalytics {
  generationTimeMs: number
  fileSizeBytes: number
  nodeTypes: string[]
  complexityScore: number
}

// Database types
export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  workflow_json: WorkflowData
  status: 'pending' | 'processing' | 'completed' | 'failed'
  node_count: number
  trigger_count: number
  generated_at?: string
  file_path?: string
  created_at: string
  updated_at: string
}

export interface GenerationLog {
  id: string
  project_id: string
  log_level: 'info' | 'warning' | 'error'
  message: string
  timestamp: string
}

export interface SharedProject {
  id: string
  project_id: string
  shared_by: string
  shared_with?: string
  share_token?: string
  permissions: 'read' | 'write'
  expires_at?: string
  created_at: string
}