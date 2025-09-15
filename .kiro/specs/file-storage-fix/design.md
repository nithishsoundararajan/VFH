# Design Document

## Overview

This design addresses the critical missing functionality in the n8n workflow converter where generated project files are created in memory but never persisted to Supabase Storage. The current implementation shows "Code generation completed successfully!" but fails to actually call AI APIs for code generation and store the resulting files, leaving users without downloadable projects.

The solution integrates security scanning, AI code generation, proper file storage, node configuration extraction, and comprehensive project structure generation to deliver complete, runnable standalone Node.js projects.

## Architecture

The file storage system integrates into the existing project creation flow by enhancing four key areas:

1. **Security Scanning Integration**: Ensures uploaded JSON files are scanned by VirusTotal before processing
2. **AI Code Generation Integration**: Ensures the system actually calls AI APIs to generate code from workflow JSON
3. **Node Configuration Processing**: Extracts and applies detailed node configurations from n8n workflow JSON
4. **File Storage and Delivery**: Creates, stores, and serves complete project archives

### High-Level Flow
```
User Upload → VirusTotal Scan → Workflow Parsing → AI Code Generation → File Storage → Download Delivery
     ↓              ↓                ↓                    ↓               ↓              ↓
  JSON File    Security Check   Extract Nodes      Generate Code     Create ZIP     Serve File
               & Validation     & Configs         with Configs      Upload to      with URL
                                                                   Supabase
```

## Components and Interfaces

### 1. Enhanced File Storage Service (`src/lib/storage/file-storage-service.ts`)

```typescript
interface FileStorageService {
  storeProjectFiles(projectId: string, files: ProjectFile[]): Promise<StorageResult>
  createZipArchive(files: ProjectFile[]): Promise<Buffer>
  uploadToSupabase(projectId: string, zipBuffer: Buffer): Promise<string>
  getDownloadUrl(projectId: string): Promise<string>
  cleanupFailedUpload(projectId: string): Promise<void>
}

interface ProjectFile {
  path: string
  content: string
  type: 'javascript' | 'json' | 'markdown' | 'text'
}

interface StorageResult {
  success: boolean
  filePath?: string
  downloadUrl?: string
  fileSize?: number
  error?: string
}
```

### 2. AI Code Generation Integration

```typescript
interface AICodeGenerator {
  generateProjectCode(
    workflowJson: any,
    nodeConfigs: NodeConfiguration[],
    projectConfig: ProjectConfiguration
  ): Promise<GeneratedProject>
}

interface NodeConfiguration {
  nodeId: string
  nodeName: string
  nodeType: string
  parameters: Record<string, any>
  credentials: Record<string, any>
  configuredParameters: ConfiguredParameter[]
  environmentVariables: EnvironmentVariable[]
  dependencies: string[]
}

interface ConfiguredParameter {
  name: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  isConfigured: boolean
  defaultValue?: any
}

interface GeneratedProject {
  files: ProjectFile[]
  dependencies: string[]
  environmentVariables: EnvironmentVariable[]
  documentation: string
}
```

### 3. Enhanced Projects API Route

The existing `/api/projects/route.ts` will be modified to:
- **Call AI APIs**: Integrate with configured AI providers (OpenAI, Gemini, etc.)
- **Extract Node Configurations**: Parse detailed node settings from workflow JSON
- **Generate Complete Projects**: Create full Node.js project structure with dependencies
- **Store Files**: Upload generated ZIP archives to Supabase Storage
- **Update Database**: Store file paths, download URLs, and metadata

### 4. Download API Route (`src/app/api/projects/[id]/download/route.ts`)

```typescript
interface DownloadResponse {
  success: boolean
  downloadUrl?: string
  fileName?: string
  fileSize?: number
  error?: string
}
```

## Data Models

### Enhanced Projects Table
```sql
-- Add columns to existing projects table
ALTER TABLE projects ADD COLUMN file_path TEXT;
ALTER TABLE projects ADD COLUMN download_url TEXT;
ALTER TABLE projects ADD COLUMN file_size BIGINT;
ALTER TABLE projects ADD COLUMN ai_provider TEXT;
ALTER TABLE projects ADD COLUMN generation_method TEXT;
ALTER TABLE projects ADD COLUMN node_configurations JSONB;
```

### Storage Bucket Structure
```
generated-projects/
├── {user_id}/
│   └── {project_id}/
│       ├── {project_name}-{timestamp}.zip
│       └── metadata.json
```

### Generated Project Structure
```
{project_name}/
├── package.json              # Dependencies and scripts
├── main.js                   # Entry point with configuration
├── config.js                 # Environment and credentials
├── .env.example              # Environment variables template
├── README.md                 # Setup and usage documentation
├── .gitignore               # Git ignore patterns
├── src/
│   ├── nodes/               # Individual node implementations
│   │   ├── HttpRequestNode.js
│   │   ├── SetNode.js
│   │   └── ...
│   ├── workflows/           # Workflow execution logic
│   │   └── WorkflowExecutor.js
│   └── base/               # Base classes and utilities
│       └── BaseNode.js
```

## AI Integration Architecture

### 1. AI Provider Selection
- Use existing `AIProviderService` to get user's configured AI provider
- Support OpenAI, Gemini, Anthropic, and system default
- Fallback to system default if user provider fails

### 2. Security-First Processing Flow
```typescript
// Pseudo-code for complete processing flow with security
const securityResult = await virusTotalScan(uploadedFile);
if (!securityResult.isSafe) {
  throw new Error('File failed security scan');
}

const workflowJson = await parseWorkflow(uploadedFile);
const nodeConfigs = await extractNodeConfigurations(workflowJson);

const aiProvider = await aiProviderService.getUserSettings(userId);
const prompt = buildCodeGenerationPrompt(workflowJson, nodeConfigs);
const generatedCode = await callAIProvider(aiProvider, prompt);
const projectFiles = await processGeneratedCode(generatedCode, nodeConfigs);
```

### 3. Node Configuration Processing
- Extract all node parameters from workflow JSON
- Identify configured vs unconfigured parameters
- Generate environment variable placeholders for credentials
- Apply configuration values directly to generated code

## Error Handling

### AI Generation Failures
1. **API Key Issues**: Validate keys before generation, provide clear error messages
2. **Rate Limiting**: Implement retry logic with exponential backoff
3. **Generation Timeouts**: Set reasonable timeouts and provide fallback options
4. **Invalid Responses**: Validate AI responses and retry if necessary

### Storage Failure Scenarios
1. **Supabase Storage Quota**: Return clear error with upgrade suggestions
2. **Network Issues**: Retry uploads with exponential backoff
3. **ZIP Creation Failures**: Log detailed errors and clean up partial files
4. **Database Update Failures**: Ensure transactional consistency

### Security Scan Failures
1. **VirusTotal API Issues**: Implement fallback scanning or manual review process
2. **Malicious File Detection**: Quarantine files and notify users with clear security warnings
3. **Scan Timeout**: Set reasonable timeouts and provide retry options
4. **False Positives**: Allow manual review process for legitimate files flagged incorrectly

### Error Recovery Strategy
- Implement comprehensive cleanup for failed operations
- Provide detailed error logging for debugging
- Update project status appropriately (failed, retry, etc.)
- Offer retry mechanisms for transient failures
- Maintain security scan history for audit purposes

## Node Configuration Handling

### Configuration Extraction Process
1. **Parse Workflow JSON**: Extract all nodes and their parameter objects
2. **Analyze Parameters**: Identify configured vs default values
3. **Extract Credentials**: Map credential references to environment variables
4. **Generate Code**: Embed configuration values directly into node implementations

### Configuration Types Supported
- **Simple Parameters**: Strings, numbers, booleans
- **Complex Objects**: Nested configuration objects
- **Arrays**: Lists of values or objects
- **Expressions**: n8n expressions converted to JavaScript
- **Credentials**: Secure credential references

### Example Configuration Processing
```javascript
// Original n8n node configuration
{
  "parameters": {
    "url": "https://api.example.com/data",
    "method": "POST",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": "Bearer {{$credentials.apiKey}}"
    },
    "body": {
      "data": "{{$json.inputData}}"
    }
  }
}

// Generated standalone code
class HttpRequestNode extends BaseNode {
  constructor() {
    super();
    this.url = "https://api.example.com/data";
    this.method = "POST";
    this.headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.API_KEY}`
    };
  }
  
  async execute(inputData) {
    const body = { data: inputData.json.inputData };
    // ... implementation
  }
}
```

## Testing Strategy

### Unit Tests
- Test AI provider integration and fallback logic
- Test node configuration extraction from various JSON structures
- Test ZIP archive creation with different file types
- Test Supabase Storage upload/download operations
- Test error handling and cleanup scenarios

### Integration Tests
- Test complete flow from workflow upload to file download
- Test AI code generation with different providers
- Test node configuration processing with complex workflows
- Test storage operations with large files
- Test concurrent project generation

### End-to-End Tests
- Test complete user workflow: upload → configure → generate → download
- Test different workflow types and node configurations
- Test error scenarios and recovery mechanisms
- Test file persistence and download functionality

## Security Considerations

### Security Scanning Integration
- **VirusTotal Integration**: All uploaded JSON files must pass VirusTotal security scanning before processing
- **Malware Detection**: Files flagged as malicious are quarantined and processing is blocked
- **Security Status Tracking**: Store and display security scan results to users
- **Scan Result Validation**: Only proceed with workflow parsing after successful security clearance

### AI Integration Security
- Validate all AI provider API keys before use
- Sanitize workflow JSON before sending to AI providers (after security scanning)
- Validate AI-generated code before storage
- Implement rate limiting to prevent abuse

### File Storage Security
- Ensure users can only access their own project files
- Implement proper RLS policies for storage bucket access
- Validate project ownership before allowing downloads
- Use signed URLs for secure file access
- Scan generated files for malicious content

### Configuration Security
- Never store credentials in generated code
- Use environment variables for all sensitive data
- Validate and sanitize all configuration inputs
- Implement proper credential management patterns

## Performance Optimization

### AI Generation Optimization
- Cache common node implementations to reduce AI calls
- Use streaming responses for large code generation
- Implement parallel processing for multiple nodes
- Optimize prompts for faster AI response times

### Storage Optimization
- Compress files before storage to reduce bandwidth
- Implement file deduplication for common project structures
- Use streaming uploads for large files
- Cache download URLs to reduce database queries

### Scalability Considerations
- Implement background job processing for large projects
- Use CDN for file distribution if needed
- Monitor storage usage and implement cleanup policies
- Consider file archival for old projects
- Implement horizontal scaling for AI generation