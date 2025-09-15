---
inclusion: always
---

# Technology Stack & Build System

## Platform Requirements
- **Node.js**: v20+ (minimum supported version)
- **Runtime**: Cross-platform (Linux, Windows, macOS)

## Core Dependencies
- `n8n-core`: Core n8n functionality for node execution
- `n8n-workflow`: Workflow parsing and execution logic
- `dotenv`: Environment variable management (optional)

## Architecture Components

### 1. Workflow Parser Module
- Reads and validates n8n JSON exports
- Extracts nodes, triggers, connections, and credentials
- Maps workflow structure to executable code

### 2. Node Mapping Module
- Maps workflow nodes to corresponding n8n package functions
- Handles both standard and community nodes (when available)
- Maintains compatibility with n8n package updates

### 3. Workflow Executor
- Executes nodes in correct dependency order
- Manages data flow between connected nodes
- Handles error propagation and logging

### 4. Configuration Management
- Secure credential storage via environment variables
- External configuration through `config.js` or `.env` files
- No hardcoded sensitive data

## Generated Project Structure
```
n8n-standalone/
├── src/
│   ├── nodes/           # Individual node implementations
│   ├── triggers/        # Trigger implementations
│   ├── workflows/       # Workflow execution scripts
├── config.js            # Configuration and environment variables
├── main.js              # Application entry point
├── package.json         # Dependencies and scripts
└── README.md           # Documentation and attribution
```

## Development Standards
- **Modularity**: Each component should be independently testable
- **Error Handling**: Graceful error handling with comprehensive logging
- **Security**: Never hardcode credentials or sensitive data
- **Attribution**: Always include proper n8n licensing and credits
- **Portability**: Code must work across all Node.js environments

## Common Commands
```bash
# Install dependencies
npm install

# Run workflow
node main.js

# Development mode (if applicable)
npm run dev

# Test workflow execution
npm test
```