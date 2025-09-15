# Workflow Configuration Interface

This document describes the workflow configuration interface implementation for the n8n Workflow Converter.

## Overview

The workflow configuration interface allows users to customize their n8n workflow conversion with project settings, environment variables, and output options. It provides comprehensive validation, sanitization, and security features.

## Features

### Project Settings
- **Project Name**: Customizable project name with validation
- **Description**: Optional project description
- **Node.js Version**: Support for Node.js 18, 20, and 22
- **Package Manager**: Choice between npm, yarn, and pnpm
- **Output Format**: ZIP or TAR.GZ archive options
- **Additional Options**: Include documentation and test templates

### Environment Variables
- **Dynamic Configuration**: Add/remove environment variables as needed
- **Automatic Detection**: Pre-populate variables based on workflow node types
- **Security Indicators**: Visual indicators for sensitive values
- **Validation**: Comprehensive validation for variable names and values
- **Required Fields**: Mark variables as required or optional

### Security Features
- **Input Sanitization**: All inputs are sanitized to prevent XSS and injection attacks
- **Validation**: Comprehensive validation for all configuration fields
- **Sensitive Data Handling**: Special handling for passwords, secrets, and API keys
- **Reserved Names**: Prevention of using reserved environment variable names

## Implementation

### Components

#### WorkflowConfiguration Component
Located at: `src/components/dashboard/workflow-configuration.tsx`

**Props:**
- `workflowMetadata`: Metadata about the uploaded workflow
- `onConfigurationComplete`: Callback when configuration is complete
- `onBack`: Optional callback for navigation

**Features:**
- Real-time validation with error display
- Input sanitization on change
- Dynamic environment variable management
- Security warnings and indicators

#### ConfigurationValidator Utility
Located at: `src/lib/validation/configuration.ts`

**Methods:**
- `sanitizeString()`: Sanitize text inputs
- `sanitizeEnvKey()`: Sanitize environment variable names
- `sanitizeProjectName()`: Sanitize project names
- `validateConfiguration()`: Validate entire configuration
- `sanitizeConfiguration()`: Sanitize entire configuration

### API Endpoints

#### POST /api/projects
Creates a new project with configuration stored in the database.

**Request Body:**
```json
{
  "name": "project-name",
  "description": "Project description",
  "workflow_json": {...},
  "node_count": 5,
  "trigger_count": 1,
  "configuration": {
    "projectName": "my-project",
    "description": "My converted workflow",
    "outputFormat": "zip",
    "includeDocumentation": true,
    "includeTests": false,
    "nodeVersion": "20",
    "packageManager": "npm",
    "environmentVariables": [
      {
        "key": "API_KEY",
        "value": "your-api-key",
        "description": "API key for external service",
        "required": true
      }
    ]
  }
}
```

#### PUT /api/projects/[id]/configuration
Updates project configuration.

#### GET /api/projects/[id]/configuration
Retrieves project configuration.

### Database Schema

The configuration is stored in the `projects` table:

```sql
ALTER TABLE projects ADD COLUMN configuration JSONB;
CREATE INDEX idx_projects_configuration ON projects USING GIN (configuration);
```

## Validation Rules

### Project Name
- Required field
- 3-50 characters
- Only letters, numbers, hyphens, and underscores
- Cannot start or end with hyphens or underscores

### Description
- Optional field
- Maximum 500 characters
- HTML tags are stripped

### Environment Variables
- **Key**: Uppercase with underscores only, maximum 100 characters
- **Value**: Maximum 1000 characters, minimum 8 for sensitive values
- **Description**: Optional, maximum 200 characters
- **Required**: Boolean flag

### Reserved Names
The following environment variable names are reserved:
- PATH
- HOME
- USER
- PWD
- SHELL
- TERM
- NODE_ENV

## Security Considerations

### Input Sanitization
All user inputs are sanitized to prevent:
- XSS attacks through HTML tag removal
- Script injection through dangerous pattern removal
- SQL injection through proper parameterization

### Sensitive Data
- Passwords and secrets are masked in the UI
- Sensitive values require minimum length validation
- Visual indicators show which fields contain sensitive data

### Validation
- Client-side validation for immediate feedback
- Server-side validation for security
- Comprehensive error messages for user guidance

## Usage Examples

### Basic Configuration
```typescript
const configuration = {
  projectName: 'my-workflow',
  description: 'Converted n8n workflow',
  outputFormat: 'zip',
  includeDocumentation: true,
  includeTests: false,
  nodeVersion: '20',
  packageManager: 'npm',
  environmentVariables: []
};
```

### With Environment Variables
```typescript
const configuration = {
  // ... basic config
  environmentVariables: [
    {
      key: 'API_BASE_URL',
      value: 'https://api.example.com',
      description: 'Base URL for API requests',
      required: true
    },
    {
      key: 'API_SECRET',
      value: 'your-secret-key',
      description: 'Secret key for API authentication',
      required: true
    }
  ]
};
```

## Testing

### Unit Tests
- Configuration validation tests
- Input sanitization tests
- Component rendering tests

### Integration Tests
- API endpoint tests
- Database storage tests
- End-to-end workflow tests

## Error Handling

### Client-Side
- Real-time validation with immediate feedback
- Error messages displayed inline with form fields
- Prevention of form submission with invalid data

### Server-Side
- Comprehensive validation before database storage
- Detailed error messages for debugging
- Graceful error handling with user-friendly messages

## Future Enhancements

### Planned Features
- Configuration templates for common workflows
- Import/export configuration functionality
- Advanced validation rules
- Configuration versioning
- Bulk environment variable management

### Performance Optimizations
- Debounced validation for better UX
- Lazy loading of configuration options
- Caching of validation results