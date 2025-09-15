# API Documentation

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Edge Functions](#edge-functions)
4. [REST API Endpoints](#rest-api-endpoints)
5. [Real-time Subscriptions](#real-time-subscriptions)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [SDK Examples](#sdk-examples)

## Overview

The n8n Workflow Converter provides both REST API endpoints and Supabase Edge Functions for secure workflow processing. All APIs require authentication and follow RESTful conventions.

### Base URLs

- **Production**: `https://your-domain.com/api`
- **Development**: `http://localhost:3000/api`
- **Edge Functions**: `https://your-project.supabase.co/functions/v1`

### Content Types

- **Request**: `application/json`
- **Response**: `application/json`
- **File Upload**: `multipart/form-data`

## Authentication

### JWT Token Authentication

All API requests require a valid Supabase JWT token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

### Getting a Token

```javascript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, anonKey)

// Sign in to get token
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password'
})

const token = data.session?.access_token
```

### Token Refresh

Tokens automatically refresh through the Supabase client. For manual refresh:

```javascript
const { data, error } = await supabase.auth.refreshSession()
```

## Edge Functions

### Parse Workflow Function

Securely parses and validates n8n workflow JSON files.

**Endpoint**: `POST /functions/v1/parse-workflow`

**Headers**:
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "workflowData": {
    "name": "My Workflow",
    "nodes": [...],
    "connections": {...}
  },
  "fileName": "workflow.json",
  "userId": "user-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "workflowId": "workflow-uuid",
    "nodeCount": 5,
    "triggerCount": 1,
    "supportedNodes": ["httpRequest", "set", "if"],
    "unsupportedNodes": [],
    "securityScan": {
      "safe": true,
      "scanId": "scan-uuid"
    }
  }
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_WORKFLOW",
    "message": "Workflow JSON is malformed",
    "details": "Missing required 'nodes' property"
  }
}
```

### Node Mapping Function

Maps workflow nodes to n8n package implementations.

**Endpoint**: `POST /functions/v1/map-nodes`

**Request Body**:
```json
{
  "workflowId": "workflow-uuid",
  "nodes": [
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {...}
    }
  ]
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "mappedNodes": [
      {
        "nodeId": "node-uuid",
        "type": "httpRequest",
        "packageName": "n8n-nodes-base",
        "implementation": "HttpRequest",
        "supported": true
      }
    ],
    "dependencies": [
      "n8n-core@1.0.0",
      "n8n-workflow@1.0.0"
    ]
  }
}
```

### Code Generation Function

Generates standalone Node.js project from mapped workflow.

**Endpoint**: `POST /functions/v1/generate-code`

**Request Body**:
```json
{
  "workflowId": "workflow-uuid",
  "projectName": "my-workflow-project",
  "configuration": {
    "nodeVersion": "20",
    "packageManager": "npm",
    "includeTests": true
  },
  "aiProvider": {
    "provider": "openai",
    "model": "gpt-4"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "projectId": "project-uuid",
    "status": "generating",
    "estimatedTime": 120,
    "progressChannel": "project-progress-uuid"
  }
}
```

## REST API Endpoints

### Projects

#### List Projects

**Endpoint**: `GET /api/projects`

**Query Parameters**:
- `page` (number): Page number (default: 1)
- `limit` (number): Items per page (default: 20)
- `status` (string): Filter by status (pending, processing, completed, failed)
- `search` (string): Search by project name

**Response**:
```json
{
  "data": [
    {
      "id": "project-uuid",
      "name": "My Workflow",
      "status": "completed",
      "nodeCount": 5,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:05:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 50,
    "pages": 3
  }
}
```

#### Get Project

**Endpoint**: `GET /api/projects/{id}`

**Response**:
```json
{
  "data": {
    "id": "project-uuid",
    "name": "My Workflow",
    "description": "A sample workflow",
    "status": "completed",
    "nodeCount": 5,
    "triggerCount": 1,
    "workflowJson": {...},
    "generatedAt": "2024-01-01T00:05:00Z",
    "filePath": "projects/user-uuid/project-uuid.zip",
    "analytics": {
      "generationTimeMs": 45000,
      "fileSizeBytes": 1024000,
      "complexityScore": 3
    }
  }
}
```

#### Create Project

**Endpoint**: `POST /api/projects`

**Request Body**:
```json
{
  "name": "My New Workflow",
  "description": "Description of the workflow",
  "workflowJson": {...},
  "configuration": {
    "nodeVersion": "20",
    "packageManager": "npm"
  }
}
```

#### Update Project

**Endpoint**: `PUT /api/projects/{id}`

**Request Body**:
```json
{
  "name": "Updated Workflow Name",
  "description": "Updated description"
}
```

#### Delete Project

**Endpoint**: `DELETE /api/projects/{id}`

**Response**:
```json
{
  "success": true,
  "message": "Project deleted successfully"
}
```

### File Management

#### Upload Workflow File

**Endpoint**: `POST /api/files/upload`

**Content-Type**: `multipart/form-data`

**Form Data**:
- `file`: The workflow JSON file
- `projectName`: Optional project name

**Response**:
```json
{
  "success": true,
  "data": {
    "fileId": "file-uuid",
    "fileName": "workflow.json",
    "fileSize": 1024,
    "securityScan": {
      "status": "scanning",
      "scanId": "scan-uuid"
    }
  }
}
```

#### Download Project

**Endpoint**: `GET /api/projects/{id}/download`

**Query Parameters**:
- `format` (string): Download format (zip, tar.gz)

**Response**: Binary file download

#### List Project Files

**Endpoint**: `GET /api/projects/{id}/files`

**Response**:
```json
{
  "data": [
    {
      "name": "main.js",
      "path": "main.js",
      "size": 2048,
      "type": "file"
    },
    {
      "name": "src",
      "path": "src/",
      "type": "directory",
      "children": [...]
    }
  ]
}
```

#### Download Individual File

**Endpoint**: `GET /api/projects/{id}/files/{filename}`

**Response**: Binary file content

### Analytics

#### Get User Analytics

**Endpoint**: `GET /api/analytics`

**Query Parameters**:
- `period` (string): Time period (day, week, month, year)
- `startDate` (string): Start date (ISO format)
- `endDate` (string): End date (ISO format)

**Response**:
```json
{
  "data": {
    "totalProjects": 25,
    "successfulConversions": 23,
    "successRate": 0.92,
    "averageGenerationTime": 45000,
    "mostUsedNodes": [
      {"type": "httpRequest", "count": 15},
      {"type": "set", "count": 12}
    ],
    "projectsByStatus": {
      "completed": 23,
      "failed": 2,
      "processing": 0
    }
  }
}
```

#### Get Project Analytics

**Endpoint**: `GET /api/projects/{id}/analytics`

**Response**:
```json
{
  "data": {
    "generationTimeMs": 45000,
    "fileSizeBytes": 1024000,
    "nodeTypes": ["httpRequest", "set", "if"],
    "complexityScore": 3,
    "optimizationSuggestions": [
      "Consider combining sequential Set nodes",
      "HTTP Request timeout could be optimized"
    ]
  }
}
```

## Real-time Subscriptions

### Project Progress Updates

Subscribe to real-time project generation progress:

```javascript
const channel = supabase
  .channel(`project-progress-${projectId}`)
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'projects',
    filter: `id=eq.${projectId}`
  }, (payload) => {
    console.log('Project updated:', payload.new)
  })
  .subscribe()
```

### Generation Logs

Subscribe to live generation logs:

```javascript
const logsChannel = supabase
  .channel(`project-logs-${projectId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'generation_logs',
    filter: `project_id=eq.${projectId}`
  }, (payload) => {
    console.log('New log:', payload.new)
  })
  .subscribe()
```

## Error Handling

### Error Response Format

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Additional error details",
    "timestamp": "2024-01-01T00:00:00Z",
    "requestId": "req-uuid"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Invalid or missing authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `INVALID_INPUT` | 400 | Request validation failed |
| `FILE_TOO_LARGE` | 413 | Uploaded file exceeds size limit |
| `UNSUPPORTED_FORMAT` | 415 | Unsupported file format |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Handling Best Practices

```javascript
async function handleApiCall() {
  try {
    const response = await fetch('/api/projects', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`API Error: ${error.error.message}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API call failed:', error)
    
    // Handle specific error types
    if (error.message.includes('UNAUTHORIZED')) {
      // Redirect to login
      window.location.href = '/login'
    } else if (error.message.includes('RATE_LIMITED')) {
      // Show rate limit message
      showNotification('Too many requests. Please try again later.')
    }
    
    throw error
  }
}
```

## Rate Limiting

### Limits

- **API Requests**: 100 requests per minute per user
- **File Uploads**: 10 uploads per hour per user
- **Code Generation**: 5 generations per hour per user

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits

```javascript
function checkRateLimit(response) {
  const remaining = response.headers.get('X-RateLimit-Remaining')
  const reset = response.headers.get('X-RateLimit-Reset')
  
  if (remaining && parseInt(remaining) < 10) {
    console.warn(`Rate limit warning: ${remaining} requests remaining`)
  }
  
  if (response.status === 429) {
    const resetTime = new Date(parseInt(reset) * 1000)
    throw new Error(`Rate limited. Try again at ${resetTime.toLocaleTimeString()}`)
  }
}
```

## SDK Examples

### JavaScript/TypeScript SDK

```javascript
import { WorkflowConverterClient } from '@n8n-converter/sdk'

const client = new WorkflowConverterClient({
  apiUrl: 'https://your-domain.com/api',
  supabaseUrl: 'https://your-project.supabase.co',
  supabaseKey: 'your-anon-key'
})

// Authenticate
await client.auth.signIn('user@example.com', 'password')

// Upload and convert workflow
const project = await client.projects.create({
  name: 'My Workflow',
  file: workflowFile
})

// Monitor progress
client.projects.onProgress(project.id, (progress) => {
  console.log(`Progress: ${progress.percentage}%`)
})

// Download when complete
const zipFile = await client.projects.download(project.id)
```

### Python SDK

```python
from n8n_converter import WorkflowConverterClient

client = WorkflowConverterClient(
    api_url="https://your-domain.com/api",
    supabase_url="https://your-project.supabase.co",
    supabase_key="your-anon-key"
)

# Authenticate
client.auth.sign_in("user@example.com", "password")

# Upload and convert
with open("workflow.json", "rb") as f:
    project = client.projects.create(
        name="My Workflow",
        file=f
    )

# Wait for completion
project.wait_for_completion()

# Download result
project.download("./output.zip")
```

### cURL Examples

#### Upload Workflow

```bash
curl -X POST "https://your-domain.com/api/files/upload" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -F "file=@workflow.json" \
  -F "projectName=My Workflow"
```

#### Get Project Status

```bash
curl -X GET "https://your-domain.com/api/projects/$PROJECT_ID" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json"
```

#### Download Project

```bash
curl -X GET "https://your-domain.com/api/projects/$PROJECT_ID/download" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -o "project.zip"
```

For more examples and advanced usage, see our [SDK Documentation](./SDK-DOCUMENTATION.md) and [Integration Examples](./INTEGRATION-EXAMPLES.md).