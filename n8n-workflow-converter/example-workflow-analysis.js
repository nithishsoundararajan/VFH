/**
 * Example: Configuration Analysis of Telegram Nutrition Assistant Workflow
 * This demonstrates how our system extracts detailed node configurations
 */

// Sample workflow JSON (from the provided example)
const workflowExample = {
  "nodes": [
    {
      "id": "c142f5dd-fbeb-4b25-a0fe-f684546e6eff",
      "name": "Download Voice Message",
      "type": "n8n-nodes-base.telegram",
      "position": [2144, 1072],
      "parameters": {
        "fileId": "={{ $('Telegram Trigger').item.json.message.voice.file_id }}",
        "resource": "file",
        "additionalFields": {}
      },
      "credentials": {
        "telegramApi": {
          "id": "yxDk2RnbewqwPdMO",
          "name": "Pruebas"
        }
      },
      "typeVersion": 1.2
    },
    {
      "id": "e15bb617-61da-4620-936d-15b0b5cf9c59",
      "name": "Input Message Router1",
      "type": "n8n-nodes-base.switch",
      "position": [1776, 1136],
      "parameters": {
        "rules": {
          "values": [
            {
              "outputKey": "Text",
              "conditions": {
                "options": {
                  "version": 2,
                  "leftValue": "",
                  "caseSensitive": true,
                  "typeValidation": "strict"
                },
                "combinator": "and",
                "conditions": [
                  {
                    "id": "fcb767ee-565e-4b56-a54e-6f97f739fc24",
                    "operator": {
                      "type": "string",
                      "operation": "exists",
                      "singleValue": true
                    },
                    "leftValue": "={{ $('Telegram Trigger').item.json.message.text }}",
                    "rightValue": ""
                  }
                ]
              },
              "renameOutput": true
            }
          ]
        },
        "options": {
          "ignoreCase": false,
          "fallbackOutput": "extra",
          "allMatchingOutputs": true
        }
      },
      "typeVersion": 3.2
    },
    {
      "id": "68f15a08-cbe2-4ad9-9cfe-8b7a7c60787c",
      "name": "get_message (text)",
      "type": "n8n-nodes-base.set",
      "position": [2144, 912],
      "parameters": {
        "options": {},
        "assignments": {
          "assignments": [
            {
              "id": "801ec600-22ad-4a94-a2b4-ae72eb271df0",
              "name": "message",
              "type": "string",
              "value": "={{ $('Telegram Trigger').item.json.message.text }}"
            },
            {
              "id": "263071fb-bcdf-42b0-bb46-71b75fa0bf2a",
              "name": "chat_id",
              "type": "string",
              "value": "={{ $('Telegram Trigger').item.json.message.chat.id }}"
            }
          ]
        }
      },
      "typeVersion": 3.4
    }
  ]
};

// Import our configuration extractor
const { nodeConfigExtractor } = require('./src/lib/node-configuration/config-extractor');

// Extract configurations from the example workflow
console.log('🔍 Analyzing Telegram Nutrition Assistant Workflow...\n');

const extractedConfigs = nodeConfigExtractor.extractWorkflowConfiguration(workflowExample);

// Display the extracted configurations
extractedConfigs.forEach((config, index) => {
  console.log(`📋 Node ${index + 1}: ${config.nodeName}`);
  console.log(`   Type: ${config.nodeType}`);
  console.log(`   Parameters (${config.configuredParameters.length}):`);
  
  config.configuredParameters.forEach(param => {
    console.log(`     • ${param.name}: ${JSON.stringify(param.value)} (${param.type})`);
    if (param.isExpression) {
      console.log(`       → Expression: ${param.value}`);
    }
  });
  
  if (config.credentials.length > 0) {
    console.log(`   Credentials:`);
    config.credentials.forEach(cred => {
      console.log(`     • ${cred.type}: ${cred.name}`);
    });
  }
  
  if (config.environmentVariables.length > 0) {
    console.log(`   Environment Variables:`);
    config.environmentVariables.forEach(env => {
      console.log(`     • ${env.key}: ${env.description}`);
    });
  }
  
  console.log(`   Dependencies: ${config.dependencies.join(', ')}`);
  console.log('');
});

module.exports = { workflowExample, extractedConfigs };