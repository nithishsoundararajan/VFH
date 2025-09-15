# Tutorials

## Table of Contents

1. [Quick Start Tutorial](#quick-start-tutorial)
2. [Converting Your First Workflow](#converting-your-first-workflow)
3. [Advanced Configuration](#advanced-configuration)
4. [Working with Complex Workflows](#working-with-complex-workflows)
5. [Deployment Guide](#deployment-guide)
6. [Integration Examples](#integration-examples)

## Quick Start Tutorial

### Step 1: Export Your n8n Workflow

1. Open your n8n instance
2. Navigate to the workflow you want to convert
3. Click the "..." menu in the top-right corner
4. Select "Export" → "Download"
5. Save the JSON file to your computer

### Step 2: Upload and Convert

1. **Sign Up**: Create an account on the converter platform
2. **Upload**: Drag your JSON file to the upload area
3. **Wait**: Let the security scan complete (usually 10-30 seconds)
4. **Configure**: Set any required environment variables
5. **Convert**: Click "Convert Workflow" and monitor progress

### Step 3: Download and Run

1. **Download**: Once complete, download the ZIP file
2. **Extract**: Unzip to your desired location
3. **Install**: Run `npm install` in the project directory
4. **Configure**: Copy `.env.example` to `.env` and set your values
5. **Run**: Execute `npm start` to run your workflow

**Congratulations!** You've successfully converted your first n8n workflow to standalone code.

## Converting Your First Workflow

### Example: Simple HTTP Request Workflow

Let's walk through converting a basic workflow that makes an HTTP request and processes the response.

#### Original n8n Workflow
```json
{
  "name": "Simple API Call",
  "nodes": [
    {
      "name": "HTTP Request",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.github.com/users/octocat",
        "method": "GET"
      }
    },
    {
      "name": "Set Data",
      "type": "n8n-nodes-base.set",
      "parameters": {
        "values": {
          "string": [
            {
              "name": "username",
              "value": "={{$json.login}}"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "HTTP Request": {
      "main": [
        [
          {
            "node": "Set Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

#### Generated Project Structure
```
simple-api-call/
├── src/
│   ├── nodes/
│   │   ├── HttpRequest.js
│   │   └── Set.js
│   └── workflows/
│       └── simple-api-call.js
├── config.js
├── main.js
├── package.json
└── README.md
```

#### Generated Code Example
```javascript
// src/workflows/simple-api-call.js
import { HttpRequest } from '../nodes/HttpRequest.js';
import { Set } from '../nodes/Set.js';

export class SimpleApiCallWorkflow {
  async execute() {
    try {
      // Execute HTTP Request node
      const httpResult = await HttpRequest.execute({
        url: 'https://api.github.com/users/octocat',
        method: 'GET'
      });

      // Execute Set node with HTTP result
      const setResult = await Set.execute({
        values: {
          string: [
            {
              name: 'username',
              value: httpResult.login
            }
          ]
        }
      }, httpResult);

      return setResult;
    } catch (error) {
      console.error('Workflow execution failed:', error);
      throw error;
    }
  }
}
```

## Advanced Configuration

### Environment Variables Setup

Create a comprehensive `.env` file for your generated project:

```bash
# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/mydb
REDIS_URL=redis://localhost:6379

# API Keys
OPENAI_API_KEY=sk-your-openai-key
SLACK_BOT_TOKEN=xoxb-your-slack-token
GITHUB_TOKEN=ghp_your-github-token

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Application Settings
NODE_ENV=production
LOG_LEVEL=info
PORT=3000
```

### Custom Node Configuration

For workflows with custom or community nodes:

1. **Identify Custom Nodes**: Check the conversion logs for unsupported nodes
2. **Manual Implementation**: Create custom node implementations
3. **Package Dependencies**: Add required packages to package.json
4. **Integration**: Wire custom nodes into the workflow execution

Example custom node implementation:
```javascript
// src/nodes/CustomSlackNode.js
export class CustomSlackNode {
  static async execute(parameters, inputData) {
    const { WebClient } = await import('@slack/web-api');
    
    const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
    
    const result = await slack.chat.postMessage({
      channel: parameters.channel,
      text: parameters.message || inputData.message
    });
    
    return {
      success: result.ok,
      timestamp: result.ts,
      channel: result.channel
    };
  }
}
```

## Working with Complex Workflows

### Multi-Branch Workflows

For workflows with conditional logic and multiple execution paths:

#### Handling IF Nodes
```javascript
// Generated code for IF node logic
if (inputData.value > parameters.threshold) {
  // Execute true branch
  const trueResult = await TrueBranchNode.execute(parameters.trueParams, inputData);
  return trueResult;
} else {
  // Execute false branch
  const falseResult = await FalseBranchNode.execute(parameters.falseParams, inputData);
  return falseResult;
}
```

#### Loop Handling
```javascript
// Generated code for loop execution
const results = [];
for (const item of inputData.items) {
  const loopResult = await LoopBodyNode.execute(parameters, item);
  results.push(loopResult);
}
return { items: results };
```

### Error Handling in Complex Workflows

```javascript
// Generated error handling
export class ComplexWorkflow {
  async execute() {
    const results = [];
    const errors = [];

    for (const node of this.nodes) {
      try {
        const result = await node.execute();
        results.push(result);
      } catch (error) {
        errors.push({
          node: node.name,
          error: error.message,
          timestamp: new Date().toISOString()
        });
        
        // Continue or stop based on error handling strategy
        if (node.continueOnFail) {
          continue;
        } else {
          throw error;
        }
      }
    }

    return { results, errors };
  }
}
```

## Deployment Guide

### Docker Deployment

Create a Dockerfile for your generated project:

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY config.js main.js ./

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose port
EXPOSE 3000

# Start application
CMD ["node", "main.js"]
```

### Docker Compose Setup

```yaml
version: '3.8'

services:
  workflow-app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://postgres:password@db:5432/workflows
    depends_on:
      - db
      - redis

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: workflows
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Cloud Deployment

#### Vercel Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

#### Railway Deployment
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway deploy
```

## Integration Examples

### Express.js Integration

Integrate your workflow into an Express.js application:

```javascript
// server.js
import express from 'express';
import { MyWorkflow } from './src/workflows/my-workflow.js';

const app = express();
app.use(express.json());

// Webhook endpoint to trigger workflow
app.post('/webhook/trigger', async (req, res) => {
  try {
    const workflow = new MyWorkflow();
    const result = await workflow.execute(req.body);
    
    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(3000, () => {
  console.log('Workflow server running on port 3000');
});
```

### Cron Job Integration

Set up scheduled execution:

```javascript
// scheduler.js
import cron from 'node-cron';
import { MyWorkflow } from './src/workflows/my-workflow.js';

// Run every day at 9 AM
cron.schedule('0 9 * * *', async () => {
  console.log('Starting scheduled workflow execution...');
  
  try {
    const workflow = new MyWorkflow();
    const result = await workflow.execute();
    
    console.log('Workflow completed successfully:', result);
  } catch (error) {
    console.error('Workflow execution failed:', error);
  }
});

console.log('Scheduler started');
```

### AWS Lambda Integration

Deploy as a serverless function:

```javascript
// lambda.js
import { MyWorkflow } from './src/workflows/my-workflow.js';

export const handler = async (event, context) => {
  try {
    const workflow = new MyWorkflow();
    const result = await workflow.execute(event);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result: result
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};
```

### Next Steps

After completing these tutorials, you should be able to:
- Convert any n8n workflow to standalone code
- Configure complex workflows with custom settings
- Deploy your workflows to various platforms
- Integrate workflows into existing applications

For more advanced topics, check out our [Developer Guide](./DEVELOPER-GUIDE.md) and [API Documentation](./API-DOCUMENTATION.md).