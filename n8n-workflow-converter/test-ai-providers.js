#!/usr/bin/env node

/**
 * Comprehensive AI Providers Test
 * Tests both OpenRouter and Gemini APIs for code generation
 */

import { config } from 'dotenv';
import fetch from 'node-fetch';
import { writeFile } from 'fs/promises';

// Load environment variables from .env.local
config({ path: '.env.local' });

class AIProviderTester {
  constructor() {
    this.openRouterKey = process.env.OPENROUTER_API_KEY;
    this.geminiKey = process.env.GOOGLE_AI_API_KEY;
  }

  async testOpenRouter() {
    console.log('🔵 Testing OpenRouter API (GPT-4o-mini)...\n');

    if (!this.openRouterKey) {
      console.log('❌ OpenRouter API key not found');
      return null;
    }

    const prompt = `Create a Node.js function that calculates the factorial of a number using recursion. Include JSDoc comments and error handling.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openRouterKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://n8n-workflow-converter.com',
          'X-Title': 'n8n Workflow Converter - Provider Test',
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'You are a JavaScript expert. Generate clean, production-ready code with proper error handling and documentation.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500,
          temperature: 0.1
        })
      });

      if (response.ok) {
        const data = await response.json();
        const code = data.choices[0]?.message?.content || '';

        console.log('✅ OpenRouter generation successful!');
        console.log(`📊 Tokens used: ${data.usage?.total_tokens || 'N/A'}`);
        console.log(`🤖 Model: ${data.model || 'N/A'}\n`);

        return {
          provider: 'OpenRouter',
          model: data.model,
          code: this.cleanCode(code),
          tokens: data.usage?.total_tokens,
          success: true
        };
      } else {
        console.log(`❌ OpenRouter failed: ${response.status} ${response.statusText}`);
        return null;
      }
    } catch (error) {
      console.log(`❌ OpenRouter error: ${error.message}`);
      return null;
    }
  }

  async testGemini() {
    console.log('🟢 Testing Google Gemini API...\n');

    if (!this.geminiKey) {
      console.log('❌ Gemini API key not found');
      return null;
    }

    const prompt = `Create a Node.js function that calculates the factorial of a number using recursion. Include JSDoc comments and error handling.`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${this.geminiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a JavaScript expert. Generate clean, production-ready code with proper error handling and documentation.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 1,
            maxOutputTokens: 1500,
          },
          safetySettings: [
            {
              category: 'HARM_CATEGORY_HARASSMENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_HATE_SPEECH',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            },
            {
              category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
              threshold: 'BLOCK_MEDIUM_AND_ABOVE'
            }
          ]
        })
      });

      if (response.ok) {
        const data = await response.json();
        const code = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        console.log('✅ Gemini generation successful!');
        console.log(`📊 Response received\n`);

        return {
          provider: 'Gemini',
          model: 'gemini-1.5-flash-latest',
          code: this.cleanCode(code),
          success: true
        };
      } else {
        console.log(`❌ Gemini failed: ${response.status} ${response.statusText}`);
        return null;
      }
    } catch (error) {
      console.log(`❌ Gemini error: ${error.message}`);
      return null;
    }
  }

  cleanCode(code) {
    // Remove markdown code blocks if present
    return code
      .replace(/```javascript\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
  }

  async saveResults(results) {
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result && result.success) {
        const filename = `generated-factorial-${result.provider.toLowerCase()}.js`;
        await writeFile(filename, result.code);
        console.log(`💾 ${result.provider} code saved to: ${filename}`);
      }
    }
  }

  async runTests() {
    console.log('🚀 Starting AI Providers Comprehensive Test\n');
    console.log('='.repeat(60));

    const results = [];

    // Test OpenRouter
    const openRouterResult = await this.testOpenRouter();
    results.push(openRouterResult);

    console.log('-'.repeat(60));

    // Test Gemini
    const geminiResult = await this.testGemini();
    results.push(geminiResult);

    console.log('='.repeat(60));

    // Summary
    console.log('\n📋 Test Summary:');
    const successful = results.filter(r => r && r.success);
    const failed = results.filter(r => !r || !r.success);

    console.log(`✅ Successful: ${successful.length}`);
    console.log(`❌ Failed: ${failed.length}`);

    if (successful.length > 0) {
      console.log('\n🎉 Working Providers:');
      successful.forEach(result => {
        console.log(`   • ${result.provider} (${result.model || 'N/A'})`);
        if (result.tokens) {
          console.log(`     Tokens: ${result.tokens}`);
        }
      });
    }

    if (failed.length > 0) {
      console.log('\n⚠️  Failed Providers:');
      results.forEach(result => {
        if (!result || !result.success) {
          const providerName = result?.provider || 'Unknown';
          console.log(`   • ${providerName}`);
        }
      });
    }

    // Save generated code
    await this.saveResults(results);

    console.log('\n🏁 Test completed!');

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      results: successful
    };
  }
}

// Run the comprehensive test
const tester = new AIProviderTester();
tester.runTests().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});