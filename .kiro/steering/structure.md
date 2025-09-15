---
inclusion: always
---

# Project Organization & Structure

## Repository Structure
```
project-root/
├── .kiro/                    # Kiro configuration and steering
│   └── steering/            # AI assistant guidance files
├── .vscode/                 # VS Code workspace settings
├── best-practices.md        # Development best practices
├── project-docs-rules.md    # Documentation guidelines
├── VFH PRD.md              # Product Requirements Document
└── VFH PRD.txt             # PRD backup/alternate format
```

## Generated Output Structure
When converting n8n workflows, the tool generates projects with this structure:

```
n8n-standalone/
├── src/
│   ├── nodes/              # Node implementations
│   │   ├── [NodeType].js   # Individual node modules
│   │   └── index.js        # Node registry/exports
│   ├── triggers/           # Trigger implementations
│   │   ├── [TriggerType].js # Individual trigger modules
│   │   └── index.js        # Trigger registry/exports
│   └── workflows/          # Workflow execution logic
│       ├── [WorkflowName].js # Individual workflow files
│       └── index.js        # Workflow registry/exports
├── config.js               # Configuration management
├── main.js                 # Application entry point
├── package.json           # Dependencies and metadata
├── .env.example           # Environment variable template
└── README.md              # Documentation and attribution
```

## File Naming Conventions
- **Node files**: Use PascalCase matching n8n node names (e.g., `HttpRequest.js`, `Set.js`)
- **Workflow files**: Use kebab-case for readability (e.g., `user-onboarding.js`)
- **Configuration**: Use standard Node.js conventions (`config.js`, `.env`)
- **Documentation**: Use descriptive names (`README.md`, `LICENSE`)

## Module Organization Principles
1. **Separation of Concerns**: Each module handles a single responsibility
2. **Dependency Injection**: Configuration and credentials passed as parameters
3. **Error Boundaries**: Each module handles its own error cases
4. **Logging Integration**: Consistent logging across all modules
5. **Testability**: Modules designed for easy unit testing

## Documentation Requirements
- Each generated project must include comprehensive README.md
- Proper attribution to n8n and used packages
- Configuration instructions for credentials and environment
- Usage examples and common troubleshooting steps
- License information for all dependencies

## Code Organization Standards
- Use ES6+ module syntax (`import`/`export`)
- Implement consistent error handling patterns
- Include JSDoc comments for public APIs
- Follow Node.js best practices for async/await usage
- Maintain clean separation between business logic and n8n integration