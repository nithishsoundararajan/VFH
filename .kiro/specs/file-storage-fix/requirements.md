# Requirements Document

## Introduction

The n8n workflow converter currently generates project files in memory but fails to store them in Supabase Storage, resulting in users seeing "Code generation completed successfully!" without any actual files being available for download. This feature addresses the missing file persistence functionality to ensure generated projects are properly stored and accessible. The generated projects must include complete Node.js codebases with proper dependency management, configuration handling for both configured and unconfigured nodes, and comprehensive documentation.

## Requirements

### Requirement 1

**User Story:** As a user who has uploaded and configured an n8n workflow, I want the system to process my workflow through AI code generation and store the generated project files in Supabase Storage so that I can download them after generation completes.

#### Acceptance Criteria

1. WHEN a project generation starts THEN the system SHALL call the AI API to process the workflow JSON and generate code
2. WHEN AI code generation completes THEN the system SHALL store all generated files in Supabase Storage
3. WHEN files are stored THEN the system SHALL create a ZIP archive containing all project files including source code, package.json, and documentation
4. WHEN the ZIP archive is created THEN the system SHALL store it in the user-specific storage bucket
5. WHEN storage is complete THEN the system SHALL update the project record with the file path and download URL
6. WHEN generating code THEN the system SHALL extract and analyze all node configuration details from the JSON, handling both extensively configured nodes and minimally configured nodes
7. WHEN processing nodes with detailed configurations THEN the system SHALL incorporate all specific configuration parameters, settings, and options directly into the generated node code
8. WHEN processing nodes with minimal configurations THEN the system SHALL apply appropriate default values while preserving any existing configuration details
9. WHEN nodes have complex configuration objects THEN the system SHALL properly serialize and embed these configurations into the standalone code

### Requirement 2

**User Story:** As a user, I want to be able to download my generated project files immediately after generation completes so that I can use the converted workflow.

#### Acceptance Criteria

1. WHEN project generation completes successfully THEN the system SHALL provide a download link for the generated project
2. WHEN I click the download link THEN the system SHALL serve the ZIP file from Supabase Storage
3. WHEN downloading THEN the system SHALL track download history and analytics
4. IF the file is not found in storage THEN the system SHALL display an appropriate error message

### Requirement 3

**User Story:** As a user, I want to see real-time progress updates during file generation and storage so that I understand what the system is doing.

#### Acceptance Criteria

1. WHEN file generation starts THEN the system SHALL log "Generating project files..." to the generation logs
2. WHEN files are being stored THEN the system SHALL log "Storing files in Supabase Storage..." with progress updates
3. WHEN ZIP creation starts THEN the system SHALL log "Creating ZIP archive..."
4. WHEN storage completes THEN the system SHALL log "Files stored successfully" with file count and size
5. IF storage fails THEN the system SHALL log detailed error information and mark the project as failed

### Requirement 4

**User Story:** As a developer, I want the file storage system to handle errors gracefully and provide detailed logging so that I can troubleshoot issues.

#### Acceptance Criteria

1. WHEN file storage fails THEN the system SHALL log the specific error details
2. WHEN storage fails THEN the system SHALL update the project status to 'failed'
3. WHEN storage fails THEN the system SHALL clean up any partially created files
4. WHEN retrying after failure THEN the system SHALL attempt to resume from the last successful step
5. WHEN storage quota is exceeded THEN the system SHALL provide a clear error message to the user

### Requirement 5

**User Story:** As a developer, I want the generated project to include proper dependency management and documentation so that I can easily install and run the converted workflow.

#### Acceptance Criteria

1. WHEN generating a project THEN the system SHALL create a package.json file with all required n8n dependencies
2. WHEN generating a project THEN the system SHALL include a comprehensive README.md file with setup instructions
3. WHEN generating a project THEN the system SHALL include installation commands for all required dependencies
4. WHEN generating a project THEN the system SHALL include usage examples and configuration instructions
5. WHEN generating a project THEN the system SHALL include proper attribution to n8n and licensing information

### Requirement 6

**User Story:** As a user, I want the generated code to include all node configurations from my n8n workflow, regardless of how extensively each node is configured, so that the standalone project runs exactly like my original workflow.

#### Acceptance Criteria

1. WHEN parsing workflow JSON THEN the system SHALL extract all available node configuration parameters, settings, and detailed options for each node
2. WHEN generating node code THEN the system SHALL embed all extracted configuration values directly into the code, preserving the exact configuration state
3. WHEN a node has extensive custom parameters and detailed settings THEN the system SHALL apply all those parameters to the generated node implementation
4. WHEN a node has minimal configuration THEN the system SHALL preserve the existing settings and supplement with appropriate defaults only where necessary
5. WHEN a node has credentials configured THEN the system SHALL generate environment variable placeholders for secure credential management
6. WHEN generating code THEN the system SHALL ensure the standalone code executes with identical behavior to the configured n8n workflow, regardless of configuration complexity
7. WHEN nodes have conditional logic, expressions, or complex configuration objects THEN the system SHALL convert them to equivalent JavaScript code while maintaining all configuration details

### 
Requirement 7

**User Story:** As a developer working on the file storage system, I want the generated project structure to support modular development and incremental updates so that the codebase remains maintainable.

#### Acceptance Criteria

1. WHEN generating project files THEN the system SHALL create a modular file structure that supports incremental development
2. WHEN storing files THEN the system SHALL organize code into separate modules for nodes, workflows, and configuration
3. WHEN updating existing projects THEN the system SHALL support partial file updates without regenerating the entire codebase
4. WHEN using database operations THEN the system SHALL utilize proper SQL queries and database migration patterns
5. WHEN integrating with external services THEN the system SHALL use appropriate MCP tools and service interfaces

### Requirement 8

**User Story:** As a user, I want the system to properly invoke AI code generation services to convert my n8n workflow JSON into functional standalone code.

#### Acceptance Criteria

1. WHEN I submit a workflow for conversion THEN the system SHALL call the configured AI provider API (OpenAI, Gemini, etc.)
2. WHEN calling the AI API THEN the system SHALL send the workflow JSON along with node configuration details
3. WHEN the AI API responds THEN the system SHALL validate the generated code before storage
4. WHEN AI generation fails THEN the system SHALL log the error and retry with appropriate fallback strategies
5. WHEN AI generation succeeds THEN the system SHALL proceed to file storage and ZIP creation
6. IF no AI provider is configured THEN the system SHALL display an appropriate error message to the user