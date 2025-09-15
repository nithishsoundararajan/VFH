# Requirements Document

## Introduction

This project is an **n8n Workflow to Standalone Codebase Converter** that enables developers to convert n8n workflows (exported as JSON) into fully functional, standalone Node.js projects that can execute without requiring the n8n runtime. The system leverages official n8n packages for node logic while maintaining modularity and compatibility with future updates.

## Requirements

### Requirement 1: Workflow JSON Processing

**User Story:** As a developer, I want to input an n8n workflow JSON file so that the system can parse and validate the workflow structure for conversion.

#### Acceptance Criteria

1. WHEN a user uploads a valid n8n workflow JSON file THEN the system SHALL parse all nodes, triggers, connections, and credentials
2. WHEN the JSON file is invalid or corrupted THEN the system SHALL return clear validation error messages
3. WHEN parsing is complete THEN the system SHALL extract workflow metadata including workflow name and node count
4. IF the workflow contains unsupported node types THEN the system SHALL log warnings but continue processing supported nodes

### Requirement 2: Node Mapping and Code Generation

**User Story:** As a developer, I want the system to map workflow nodes to official n8n package implementations so that the generated code maintains compatibility with n8n updates.

#### Acceptance Criteria

1. WHEN nodes are identified in the workflow THEN the system SHALL map each node to its corresponding function in n8n packages
2. WHEN a node type is not available in official n8n packages THEN the system SHALL log an error and skip that node
3. WHEN mapping is complete THEN the system SHALL generate Node.js scripts for each supported node
4. WHEN generating code THEN the system SHALL use ES6+ module syntax with proper imports and exports
5. WHEN creating node modules THEN the system SHALL include JSDoc comments for public APIs

### Requirement 3: Standalone Project Generation

**User Story:** As a developer, I want the system to generate a complete standalone Node.js project so that I can execute workflows without the n8n runtime.

#### Acceptance Criteria

1. WHEN code generation starts THEN the system SHALL create the following folder structure:
   - `src/nodes/` for individual node implementations
   - `src/triggers/` for trigger implementations  
   - `src/workflows/` for workflow execution logic
   - `config.js` for configuration management
   - `main.js` as the application entry point
2. WHEN generating the project THEN the system SHALL create a complete `package.json` with all required dependencies
3. WHEN the project is generated THEN the system SHALL include a comprehensive `README.md` with setup instructions
4. WHEN creating files THEN the system SHALL use proper file naming conventions (PascalCase for nodes, kebab-case for workflows)

### Requirement 4: Workflow Execution Engine

**User Story:** As a developer, I want the generated code to execute workflows correctly with proper data flow between nodes so that I don't need the n8n runtime.

#### Acceptance Criteria

1. WHEN the workflow executes THEN the system SHALL run nodes in the correct dependency order based on connections
2. WHEN data flows between nodes THEN the system SHALL pass data according to the original workflow connections
3. WHEN a node fails THEN the system SHALL handle errors gracefully and continue with other nodes where possible
4. WHEN the workflow completes THEN the system SHALL log execution results and final status
5. WHEN executing nodes THEN the system SHALL maintain the same data transformation logic as the original n8n workflow

### Requirement 5: Trigger Implementation

**User Story:** As a developer, I want the generated code to support workflow triggers so that workflows can be initiated automatically without manual intervention.

#### Acceptance Criteria

1. WHEN the workflow contains cron triggers THEN the system SHALL generate Node.js cron job implementations
2. WHEN the workflow contains webhook triggers THEN the system SHALL generate Express.js endpoint handlers
3. WHEN triggers are activated THEN the system SHALL initiate workflow execution with proper context
4. WHEN multiple triggers exist THEN the system SHALL handle them independently without conflicts

### Requirement 6: Configuration and Security Management

**User Story:** As a developer, I want to configure credentials and API keys externally so that sensitive data isn't hardcoded in the generated code.

#### Acceptance Criteria

1. WHEN the system generates configuration files THEN credentials SHALL be stored in environment variables
2. WHEN creating config files THEN the system SHALL provide a `.env.example` template with all required variables
3. WHEN accessing credentials THEN the generated code SHALL use the `dotenv` package for environment variable management
4. WHEN handling sensitive data THEN the system SHALL never hardcode API keys or passwords in generated files
5. WHEN validating inputs THEN the system SHALL sanitize all user inputs to prevent code injection

### Requirement 7: Logging and Monitoring

**User Story:** As a developer, I want comprehensive logging in the generated project so that I can track workflow execution and debug issues.

#### Acceptance Criteria

1. WHEN workflows execute THEN the system SHALL provide console logging of execution progress
2. WHEN errors occur THEN the system SHALL log detailed error messages with stack traces
3. WHEN nodes complete THEN the system SHALL track and log execution status of each node
4. WHEN logging sensitive data THEN the system SHALL sanitize logs to prevent exposure of credentials
5. WHEN generating projects THEN the system SHALL include configurable log levels (info, warning, error)

### Requirement 8: Attribution and Licensing

**User Story:** As a developer, I want proper attribution to n8n and licensing information so that I comply with open source requirements.

#### Acceptance Criteria

1. WHEN generating projects THEN the system SHALL include proper credit to n8n in the README.md
2. WHEN using n8n packages THEN the system SHALL include license information for all imported packages
3. WHEN creating documentation THEN the system SHALL reference the original n8n project and documentation
4. WHEN distributing generated code THEN the system SHALL ensure compliance with n8n's licensing terms

### Requirement 9: Frontend Interface with Dashboard

**User Story:** As a developer, I want a comprehensive web interface with user dashboard so that I can easily manage my workflow conversions and track my projects.

#### Acceptance Criteria

1. WHEN accessing the frontend THEN users SHALL be able to upload JSON files via drag-and-drop or file selection
2. WHEN uploading files THEN the system SHALL validate file type and show preview of workflow information
3. WHEN generation is in progress THEN the frontend SHALL display real-time progress logs and status updates
4. WHEN generation completes THEN the frontend SHALL provide options to download the generated project
5. WHEN configuring projects THEN the frontend SHALL allow users to set output directories and environment variables
6. WHEN viewing the dashboard THEN users SHALL see their conversion history, project status, and quick access to recent projects
7. WHEN managing projects THEN users SHALL be able to rename, delete, or organize their conversions
8. WHEN using the interface THEN it SHALL be responsive and work seamlessly on desktop, tablet, and mobile devices

### Requirement 10: User Authentication and Management

**User Story:** As a developer, I want to create an account and manage my workflow conversions so that I can track my projects and access them from anywhere.

#### Acceptance Criteria

1. WHEN a user visits the application THEN they SHALL be able to sign up using email/password or OAuth providers
2. WHEN a user is authenticated THEN they SHALL have access to their personal dashboard with conversion history
3. WHEN a user logs out THEN their session SHALL be securely terminated and require re-authentication
4. WHEN a user forgets their password THEN they SHALL be able to reset it via email
5. WHEN managing user data THEN the system SHALL comply with data privacy and security best practices

### Requirement 11: Persistent Data Storage and History

**User Story:** As a developer, I want my workflow conversions to be saved and accessible so that I can revisit previous projects and track my conversion history.

#### Acceptance Criteria

1. WHEN a user uploads a workflow JSON THEN the system SHALL store the workflow metadata in Supabase
2. WHEN code generation completes THEN the system SHALL save the project details, status, and generation timestamp
3. WHEN a user views their dashboard THEN they SHALL see a list of all their previous conversions with status and dates
4. WHEN a user wants to re-download a project THEN they SHALL be able to access previously generated codebases
5. WHEN storing user data THEN the system SHALL associate all conversions with the authenticated user's account

### Requirement 12: Real-time Progress and Collaboration

**User Story:** As a developer, I want to see real-time updates during code generation and optionally share projects with team members so that I can collaborate effectively.

#### Acceptance Criteria

1. WHEN code generation is in progress THEN the system SHALL provide real-time status updates using Supabase real-time subscriptions
2. WHEN multiple users are viewing the same project THEN they SHALL see synchronized progress updates
3. WHEN a user wants to share a project THEN they SHALL be able to generate shareable links with appropriate permissions
4. WHEN accessing shared projects THEN users SHALL have read-only access unless granted edit permissions
5. WHEN real-time updates occur THEN the system SHALL handle connection failures gracefully and reconnect automatically

### Requirement 13: Project Analytics and Insights

**User Story:** As a developer, I want to see analytics about my workflow conversions so that I can understand usage patterns and optimize my workflows.

#### Acceptance Criteria

1. WHEN viewing the dashboard THEN users SHALL see statistics about their total conversions, success rates, and most used node types
2. WHEN a conversion completes THEN the system SHALL track metrics like generation time, project size, and node count
3. WHEN analyzing workflows THEN the system SHALL provide insights about common patterns and potential optimizations
4. WHEN viewing project details THEN users SHALL see detailed information about node types, connections, and complexity
5. WHEN generating reports THEN the system SHALL respect user privacy and only show aggregated, anonymized data

### Requirement 14: Enhanced File Management

**User Story:** As a developer, I want to organize my generated projects and workflow files so that I can maintain a clean workspace and easily find specific conversions.

#### Acceptance Criteria

1. WHEN managing projects THEN users SHALL be able to organize conversions into folders or categories
2. WHEN searching for projects THEN users SHALL be able to filter by workflow name, date, status, or node types
3. WHEN storing files THEN the system SHALL use Supabase Storage for secure file management and access control
4. WHEN downloading projects THEN users SHALL have options for different export formats (ZIP, individual files, etc.)
5. WHEN managing storage THEN the system SHALL provide users with storage usage information and cleanup options

### Requirement 15: Extensibility and Maintenance

**User Story:** As a developer, I want the system to be easily extensible so that I can add support for new workflows and node types in the future.

#### Acceptance Criteria

1. WHEN adding new workflows THEN developers SHALL be able to process additional JSON files without modifying core logic
2. WHEN n8n releases new node types THEN the system SHALL be easily updatable to support them
3. WHEN extending functionality THEN the modular architecture SHALL allow independent updates to components
4. WHEN maintaining the system THEN each module SHALL have clear separation of concerns and well-defined interfaces
5. WHEN testing the system THEN all modules SHALL be designed for easy unit testing and validation
6. WHEN integrating with Supabase THEN the system SHALL use proper database migrations and version control for schema changes