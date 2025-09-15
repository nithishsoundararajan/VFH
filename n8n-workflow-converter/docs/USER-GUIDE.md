# User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account Management](#account-management)
3. [Uploading Workflows](#uploading-workflows)
4. [Project Configuration](#project-configuration)
5. [Monitoring Progress](#monitoring-progress)
6. [Managing Projects](#managing-projects)
7. [Downloading Generated Code](#downloading-generated-code)
8. [Analytics and Insights](#analytics-and-insights)
9. [Troubleshooting](#troubleshooting)

## Getting Started

### Creating an Account

1. Visit the application homepage
2. Click "Sign Up" in the top navigation
3. Choose your preferred registration method:
   - **Email/Password**: Enter your email and create a secure password
   - **Google OAuth**: Sign up using your Google account
   - **GitHub OAuth**: Sign up using your GitHub account

### First Login

After creating your account, you'll be redirected to your personal dashboard where you can:
- View your project history
- Upload new workflows
- Access analytics and insights
- Manage account settings

## Account Management

### Profile Settings

Access your profile settings by clicking your avatar in the top-right corner:

- **Personal Information**: Update your name and email
- **Password**: Change your account password
- **AI Provider Settings**: Configure your preferred AI service for code generation
- **Privacy Controls**: Manage data sharing and analytics preferences

### AI Provider Configuration

To use custom AI providers for enhanced code generation:

1. Go to Settings → AI Provider
2. Select your preferred provider (OpenAI, Anthropic, Google Gemini)
3. Enter your API key
4. Test the connection
5. Save your configuration

**Note**: If no custom AI provider is configured, the system will use the default service.

## Uploading Workflows

### Supported File Types

- **n8n JSON exports** (.json files)
- Maximum file size: 10MB
- Files are automatically scanned for security threats

### Upload Process

1. **Navigate to Upload**: Click "Upload Workflow" from your dashboard
2. **Select File**: 
   - Drag and drop your n8n JSON file
   - Or click "Browse" to select from your computer
3. **Security Scan**: Wait for automatic virus scanning to complete
4. **Preview**: Review the workflow information displayed
5. **Configure**: Set up project settings (optional)
6. **Submit**: Click "Convert Workflow" to start the process

### Workflow Preview

After uploading, you'll see:
- **Workflow Name**: Extracted from the JSON file
- **Node Count**: Total number of nodes in the workflow
- **Trigger Types**: Types of triggers used (cron, webhook, etc.)
- **Security Status**: Results of the security scan

## Project Configuration

### Environment Variables

Configure environment variables for your generated project:

1. **Database Connections**: Set up database URLs and credentials
2. **API Keys**: Configure third-party service keys
3. **Custom Settings**: Add any workflow-specific configuration

### Output Settings

Customize the generated project:
- **Project Name**: Override the default name
- **Description**: Add a project description
- **Node.js Version**: Specify target Node.js version
- **Package Manager**: Choose npm or yarn

## Monitoring Progress

### Real-time Updates

During code generation, you'll see:
- **Progress Bar**: Visual indication of completion percentage
- **Live Logs**: Real-time console output from the generation process
- **Status Updates**: Current step being executed
- **Estimated Time**: Remaining time for completion

### Progress Stages

1. **Parsing**: Analyzing the workflow JSON structure
2. **Node Mapping**: Mapping nodes to n8n package implementations
3. **Code Generation**: Creating the standalone Node.js project
4. **File Creation**: Generating project files and structure
5. **Packaging**: Creating downloadable ZIP file

## Managing Projects

### Project Dashboard

Your dashboard displays:
- **Recent Projects**: Latest conversions with status
- **Project Statistics**: Success rates and usage metrics
- **Quick Actions**: Fast access to common tasks

### Project Actions

For each project, you can:
- **Download**: Get the generated ZIP file
- **View Details**: See project information and logs
- **Rename**: Change the project name
- **Delete**: Remove the project permanently
- **Share**: Generate shareable links (if enabled)

### Project Organization

- **Search**: Find projects by name or description
- **Filter**: Sort by date, status, or node types
- **Categories**: Organize projects into folders (coming soon)

## Downloading Generated Code

### Download Options

1. **Complete Project**: Download entire project as ZIP
2. **Individual Files**: Download specific files from the project
3. **Source Code Only**: Download just the generated source files

### Generated Project Structure

Your downloaded project will contain:

```
project-name/
├── src/
│   ├── nodes/          # Individual node implementations
│   ├── triggers/       # Trigger implementations
│   └── workflows/      # Workflow execution logic
├── config.js           # Configuration management
├── main.js            # Application entry point
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variable template
└── README.md          # Project documentation
```

### Running Your Generated Project

1. **Extract**: Unzip the downloaded file
2. **Install Dependencies**: Run `npm install`
3. **Configure**: Copy `.env.example` to `.env` and set your variables
4. **Run**: Execute `npm start` or `node main.js`

## Analytics and Insights

### Usage Statistics

View your conversion analytics:
- **Total Conversions**: Number of workflows converted
- **Success Rate**: Percentage of successful conversions
- **Popular Node Types**: Most frequently used nodes
- **Generation Time**: Average time per conversion

### Workflow Analysis

For each project, see:
- **Complexity Score**: Workflow complexity rating
- **Node Distribution**: Breakdown of node types used
- **Performance Metrics**: Generation time and file size
- **Optimization Suggestions**: Recommendations for improvement

## Troubleshooting

### Common Issues

#### Upload Failures
- **File Too Large**: Ensure your JSON file is under 10MB
- **Invalid Format**: Verify the file is a valid n8n export
- **Security Scan Failed**: File may contain suspicious content

#### Generation Errors
- **Unsupported Nodes**: Some nodes may not be supported yet
- **Configuration Issues**: Check environment variable setup
- **Network Problems**: Verify internet connection

#### Download Problems
- **File Not Found**: Project may have been deleted or expired
- **Corrupt Download**: Try downloading again
- **Browser Issues**: Clear cache and cookies

### Getting Help

If you encounter issues:

1. **Check Status**: Visit the system status page
2. **Review Logs**: Check the generation logs for error details
3. **Contact Support**: Use the help form in the application
4. **Community**: Join our Discord server for community support

### Error Codes

Common error codes and their meanings:

- **E001**: Invalid workflow JSON format
- **E002**: File size exceeds limit
- **E003**: Security scan failed
- **E004**: Unsupported node type encountered
- **E005**: Generation timeout
- **E006**: Storage quota exceeded

For detailed error information, check the project logs in your dashboard.