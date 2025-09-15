#!/usr/bin/env node

/**
 * Test OpenRouter API Integration
 * This script tests the OpenRouter API by generating a simple "Hello World" JavaScript code
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables from .env.local
config({ path: '.env.local' });

async function testOpenRouterAPI() {
  console.log('🚀 Testing OpenRouter API Integration...\n');

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY not found in environment variables');
    console.log('Please check your .env.local file');
    process.exit(1);
  }

  console.log('✅ OpenRouter API Key found');
  console.log(`🔑 Key preview: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}\n`);

  const prompt = `Generate a simple "Hello World" JavaScript program that:
1. Prints "Hello World!" to the console
2. Includes a function that returns a greeting message
3. Has proper JSDoc comments
4. Uses modern ES6+ syntax

Please return only the JavaScript code, no explanations.`;

  try {
    console.log('📡 Making request to OpenRouter API...');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://n8n-workflow-converter.com',
        'X-Title': 'n8n Workflow Converter - API Test',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a JavaScript code generator. Generate clean, well-documented code based on the requirements.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.1
      })
    });

    console.log(`📊 Response Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API Request Failed:');
      console.error(`Status: ${response.status}`);
      console.error(`Error: ${errorText}`);
      return;
    }

    const data = await response.json();
    
    if (data.choices && data.choices[0] && data.choices[0].message) {
      const generatedCode = data.choices[0].message.content;
      
      console.log('✅ Code generation successful!\n');
      console.log('📝 Generated JavaScript Code:');
      console.log('=' .repeat(50));
      console.log(generatedCode);
      console.log('=' .repeat(50));
      
      // Save the generated code to a file
      const fs = await import('fs/promises');
      await fs.writeFile('generated-hello-world.js', generatedCode);
      console.log('\n💾 Code saved to: generated-hello-world.js');
      
      // Display usage statistics
      if (data.usage) {
        console.log('\n📊 API Usage Statistics:');
        console.log(`   Prompt tokens: ${data.usage.prompt_tokens || 'N/A'}`);
        console.log(`   Completion tokens: ${data.usage.completion_tokens || 'N/A'}`);
        console.log(`   Total tokens: ${data.usage.total_tokens || 'N/A'}`);
      }
      
      // Display model information
      if (data.model) {
        console.log(`\n🤖 Model used: ${data.model}`);
      }
      
      console.log('\n🎉 OpenRouter API test completed successfully!');
      
    } else {
      console.error('❌ Unexpected response format:');
      console.error(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing OpenRouter API:');
    console.error(error.message);
    
    if (error.code === 'ENOTFOUND') {
      console.error('🌐 Network error: Unable to reach OpenRouter API');
      console.error('Please check your internet connection');
    } else if (error.code === 'ECONNRESET') {
      console.error('🔌 Connection reset: API request was interrupted');
    }
  }
}

// Run the test
testOpenRouterAPI().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});