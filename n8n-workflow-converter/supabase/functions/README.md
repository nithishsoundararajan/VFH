# Supabase Edge Functions

This directory contains the Edge Functions for the n8n Workflow Converter application. These functions handle secure server-side operations including workflow parsing, node mapping, and code generation.

## Functions Overview

### 1. parse-workflow
**Endpoint**: `/functions/v1/parse-workflow`

Handles secure workflow JSON parsing with integrated security scanning.

**Features**:
- VirusTotal API integration for malware detection
- JSON validation and sanitization
- Workflow metadata extraction
- Security status reporting

**Request**:
```json
{
  "fileData": "base64_encoded_file_content",
  "fileName": "workflow.json",
  "userId": "user_uuid"
}
```

**Response**:
```json
{
  "success": true,
  "securityStatus": {
    "safe": true,
    "scanId": "scan_id",
    "permalink": "virustotal_url",
    "message": "File passed security scan"
  },
  "workflow": {
    "metadata": {
      "name": "My Workflow",
      "nodeCount": 5,
      "triggerCount": 1,
      "connections": 4,
      "nodeTypes": ["n8n-nodes-base.httpRequest", "n8n-nodes-base.set"],
      "hasCredentials": true
    },
    "sanitizedData": { /* sanitized workflow JSON */ }
  }
}
```

### 2. map-nodes
**Endpoint**: `/functions/v1/map-nodes`

Maps workflow nodes to their corresponding n8n package implementations.

**Features**:
- Node type to package mapping
- Credential type identification
- Code generation for supported nodes
- Graceful handling of unsupported nodes

**Request**:
```json
{
  "nodes": [/* array of workflow nodes */],
  "userId": "user_uuid",
  "projectId": "project_uuid"
}
```

**Response**:
```json
{
  "success": true,
  "mappedNodes": [/* array of mapped nodes */],
  "unsupportedNodes": ["unsupported.node.type"],
  "totalNodes": 5,
  "supportedNodes": 4
}
```

### 3. generate-code
**Endpoint**: `/functions/v1/generate-code`

Generates complete standalone Node.js project from mapped workflow data.

**Features**:
- Complete project structure generation
- Package.json with dependencies
- Node implementations and workflow executor
- Trigger implementations
- Documentation and configuration files
- ZIP archive creation and storage

**Request**:
```json
{
  "projectId": "project_uuid",
  "workflowData": { /* workflow JSON */ },
  "mappedNodes": [/* mapped node data */],
  "userId": "user_uuid",
  "projectName": "My Project"
}
```

**Response**:
```json
{
  "success": true,
  "projectId": "project_uuid",
  "filesGenerated": 12,
  "downloadUrl": "https://storage.url/project.zip"
}
```

## Environment Variables

The following environment variables must be configured:

### Required
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key for database access

### Optional
- `VIRUSTOTAL_API_KEY`: VirusTotal API key for security scanning

## Security Features

### Authentication
All functions require valid Supabase JWT tokens passed in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

### Input Sanitization
- All user inputs are sanitized to prevent injection attacks
- File uploads are scanned for malware using VirusTotal
- Sensitive data is masked in logs and responses

### Access Control
- Users can only access their own projects and data
- Row Level Security (RLS) policies enforce data isolation
- File storage uses user-specific access controls

## Deployment

Deploy functions using the Supabase CLI:

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy parse-workflow
supabase functions deploy map-nodes
supabase functions deploy generate-code
```

## Development

### Local Development
```bash
# Start local Supabase
supabase start

# Serve functions locally
supabase functions serve

# Test function
curl -X POST http://localhost:54321/functions/v1/parse-workflow \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fileData": "...", "fileName": "test.json", "userId": "..."}'
```

### Testing
Each function includes error handling and logging for debugging:
- Check function logs in Supabase dashboard
- Monitor real-time logs during development
- Use generation_logs table for workflow-specific logging

## File Structure

```
functions/
├── _shared/
│   ├── types.ts          # Shared TypeScript types
│   └── utils.ts          # Common utilities
├── parse-workflow/
│   ├── index.ts          # Main function code
│   └── deno.json         # Deno configuration
├── map-nodes/
│   ├── index.ts          # Main function code
│   └── deno.json         # Deno configuration
├── generate-code/
│   ├── index.ts          # Main function code
│   └── deno.json         # Deno configuration
└── README.md             # This file
```

## Error Handling

All functions implement comprehensive error handling:
- Input validation with clear error messages
- Graceful degradation for optional features
- Detailed logging for debugging
- Proper HTTP status codes and responses

## Performance Considerations

- Functions are optimized for cold start performance
- Large file processing is handled asynchronously
- Progress updates are provided via database for long-running operations
- File storage uses efficient compression and streaming