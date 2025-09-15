import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ConfigurationValidator } from '@/lib/validation/configuration';

interface CreateProjectRequest {
  name: string;
  description: string;
  workflow_json: {
    nodes?: Array<{ type: string; name: string;[key: string]: any }>;
    connections?: Record<string, any>;
    name?: string;
    [key: string]: any;
  };
  node_count: number;
  trigger_count: number;
  configuration: {
    projectName: string;
    description: string;
    outputFormat: 'zip' | 'tar.gz';
    includeDocumentation: boolean;
    includeTests: boolean;
    nodeVersion: string;
    packageManager: 'npm' | 'yarn' | 'pnpm';
    environmentVariables: Array<{
      key: string;
      value: string;
      description?: string;
      required: boolean;
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: CreateProjectRequest = await request.json();
    const { name, description, workflow_json, node_count, trigger_count, configuration } = body;

    // Validate required fields
    if (!name || !workflow_json) {
      return NextResponse.json(
        { error: 'Missing required fields: name and workflow_json' },
        { status: 400 }
      );
    }

    // Sanitize project name
    const sanitizedName = name.trim();
    if (sanitizedName.length === 0) {
      return NextResponse.json(
        { error: 'Project name cannot be empty' },
        { status: 400 }
      );
    }

    // Sanitize and validate configuration
    let sanitizedConfiguration = null;
    if (configuration) {
      try {
        // Sanitize configuration using the validation utility
        sanitizedConfiguration = ConfigurationValidator.sanitizeConfiguration(configuration);

        // Validate configuration
        const validationErrors = ConfigurationValidator.validateConfiguration(sanitizedConfiguration);
        if (validationErrors.length > 0) {
          const errorMessage = validationErrors.map(err => `${err.field}: ${err.message}`).join(', ');
          return NextResponse.json(
            { error: `Configuration validation failed: ${errorMessage}` },
            { status: 400 }
          );
        }

      } catch (configError) {
        console.error('Configuration validation error:', configError);
        return NextResponse.json(
          { error: 'Invalid configuration data' },
          { status: 400 }
        );
      }
    }

    // Create project in database with configuration
    const { data: project, error: insertError } = await supabase
      .from('projects')
      .insert({
        user_id: user.id,
        name: sanitizedName,
        description: description?.trim() || null,
        workflow_json,
        node_count: node_count || null,
        trigger_count: trigger_count || null,
        configuration: sanitizedConfiguration,
        status: 'pending'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create project' },
        { status: 500 }
      );
    }

    // Log project creation
    await supabase.from('generation_logs').insert({
      project_id: project.id,
      log_level: 'info',
      message: `Project "${sanitizedName}" created successfully`
    });

    // Update status to processing
    await supabase
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', project.id);

    // Trigger AI-powered code generation process
    try {
      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: 'Starting AI-powered code generation process...'
      });

      // Import AI code generator service
      const { AIProviderService } = await import('@/lib/services/ai-provider-service');
      const { AICodeGenerator } = await import('@/lib/services/ai-code-generator');
      const aiProviderService = new AIProviderService();
      const aiCodeGenerator = new AICodeGenerator();

      // Get user's AI provider settings
      const aiSettings = await aiProviderService.getUserSettings(user.id);

      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: `Using AI provider: ${aiSettings?.provider || 'system_default'} (Valid: ${aiSettings?.isValid || false})`
      });

      // Basic workflow validation
      if (!workflow_json.nodes || !Array.isArray(workflow_json.nodes)) {
        throw new Error('Invalid workflow: missing or invalid nodes array');
      }

      if (workflow_json.nodes.length === 0) {
        throw new Error('Workflow must contain at least one node');
      }

      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: `Workflow validation passed. Processing ${workflow_json.nodes?.length || 0} nodes...`
      });

      // Extract detailed node configurations
      const { nodeConfigExtractor } = await import('@/lib/node-configuration/config-extractor');
      const nodeConfigs = nodeConfigExtractor.extractWorkflowConfiguration(workflow_json);

      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: `Extracted configurations for ${nodeConfigs.length} nodes with ${nodeConfigs.reduce((sum, config) => sum + config.configuredParameters.length, 0)} total parameters`
      });

      // Call AI provider to generate code
      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: 'Calling AI provider for code generation...'
      });

      const aiGeneratedProject = await generateAIEnhancedProject(
        sanitizedName,
        workflow_json,
        nodeConfigs,
        sanitizedConfiguration,
        user.id,
        aiSettings,
        aiCodeGenerator
      );

      // Validate AI-generated code
      const validationResult = await validateGeneratedCode(aiGeneratedProject);

      // Initialize projectFiles variable
      let projectFiles = [];

      if (!validationResult.isValid) {
        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'warn',
          message: `AI-generated code validation failed: ${validationResult.errors.join(', ')}. Using fallback generation.`
        });

        // Fallback to configuration-aware generation
        projectFiles = await generateConfigAwareProject(
          sanitizedName,
          workflow_json,
          nodeConfigs,
          sanitizedConfiguration
        );

        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'info',
          message: `Generated ${projectFiles.length} project files using fallback method.`
        });
      } else {
        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'info',
          message: `AI code generation successful! Generated ${aiGeneratedProject.files.length} files with ${aiGeneratedProject.enhancedNodes} AI-enhanced nodes.`
        });
      }

      // Store generated files to Supabase Storage
      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: 'Storing generated files to Supabase Storage...'
      });

      const { serverFileStorage } = await import('@/lib/services/file-storage-service');

      // Determine which files to store
      const filesToStore = validationResult.isValid ? aiGeneratedProject.files : projectFiles;

      // Convert files to the expected format
      const projectFilesForStorage = filesToStore.map((file: any) => ({
        path: file.path,
        content: file.content,
        type: file.path.endsWith('.js') ? 'javascript' as const :
          file.path.endsWith('.json') ? 'json' as const :
            file.path.endsWith('.md') ? 'markdown' as const :
              file.path.endsWith('.ts') ? 'typescript' as const :
                'text' as const
      }));

      // Create GeneratedProject object
      const generatedProject = {
        files: projectFilesForStorage,
        dependencies: ['dotenv', 'lodash'], // Basic dependencies
        environmentVariables: nodeConfigs.flatMap((config: any) => config.environmentVariables || []),
        documentation: `Generated from n8n workflow: ${workflow_json.name || sanitizedName}`,
        projectName: sanitizedName,
        nodeConfigurations: nodeConfigs
      };

      // Store files with progress tracking
      const storageResult = await serverFileStorage.storeProjectFiles(
        project.id,
        user.id,
        generatedProject,
        {
          aiProvider: aiSettings?.provider || 'system_default',
          generationMethod: validationResult.isValid ? 'ai_enhanced' : 'configuration_aware',
          onProgress: async (progress) => {
            await supabase.from('generation_logs').insert({
              project_id: project.id,
              log_level: 'info',
              message: `Storage progress: ${progress.stage} - ${progress.percentage}% - ${progress.message}`
            });
          }
        }
      );

      if (!storageResult.success) {
        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'error',
          message: `File storage failed: ${storageResult.error}`
        });

        // Update project status to failed
        await supabase
          .from('projects')
          .update({
            status: 'failed',
            ai_provider: aiSettings?.provider || 'system_default',
            generation_method: 'failed'
          })
          .eq('id', project.id);

        return NextResponse.json(project);
      }

      // Update project with file information
      await supabase
        .from('projects')
        .update({
          status: 'completed',
          generated_at: new Date().toISOString(),
          ai_provider: aiSettings?.provider || 'system_default',
          generation_method: validationResult.isValid ? 'ai_enhanced' : 'configuration_aware',
          file_path: storageResult.filePath,
          download_url: storageResult.downloadUrl,
          file_size: storageResult.fileSize
        })
        .eq('id', project.id);

      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'info',
        message: `Code generation and storage completed successfully! File stored at: ${storageResult.filePath}`
      });

    } catch (error) {
      console.error('Code generation error:', error);

      // Log the error with context
      await supabase.from('generation_logs').insert({
        project_id: project.id,
        log_level: 'error',
        message: `AI code generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });

      // Attempt fallback generation without AI
      try {
        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'info',
          message: 'Attempting fallback code generation without AI...'
        });

        // Extract node configurations for fallback generation
        const { nodeConfigExtractor } = await import('@/lib/node-configuration/config-extractor');
        const fallbackNodeConfigs = nodeConfigExtractor.extractWorkflowConfiguration(workflow_json);

        // Generate basic project structure as fallback
        const fallbackFiles = await generateConfigAwareProject(
          sanitizedName,
          workflow_json,
          fallbackNodeConfigs,
          sanitizedConfiguration
        );

        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'info',
          message: `Fallback generation completed. Generated ${fallbackFiles.length} files without AI enhancement.`
        });

        // Store fallback files to Supabase Storage
        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'info',
          message: 'Storing fallback files to Supabase Storage...'
        });

        const { serverFileStorage: fallbackFileStorage } = await import('@/lib/services/file-storage-service');

        // Convert fallback files to the expected format
        const fallbackProjectFiles = fallbackFiles.map((file: any) => ({
          path: file.path,
          content: file.content,
          type: file.path.endsWith('.js') ? 'javascript' as const :
            file.path.endsWith('.json') ? 'json' as const :
              file.path.endsWith('.md') ? 'markdown' as const :
                file.path.endsWith('.ts') ? 'typescript' as const :
                  'text' as const
        }));

        // Create GeneratedProject object for fallback
        const fallbackGeneratedProject = {
          files: fallbackProjectFiles,
          dependencies: ['dotenv', 'lodash'],
          environmentVariables: fallbackNodeConfigs.flatMap((config: any) => config.environmentVariables || []),
          documentation: `Generated from n8n workflow: ${workflow_json.name || sanitizedName} (Fallback Method)`,
          projectName: sanitizedName,
          nodeConfigurations: fallbackNodeConfigs
        };

        // Store fallback files
        const fallbackStorageResult = await fallbackFileStorage.storeProjectFiles(
          project.id,
          user.id,
          fallbackGeneratedProject,
          {
            aiProvider: 'fallback',
            generationMethod: 'template_only',
            onProgress: async (progress) => {
              await supabase.from('generation_logs').insert({
                project_id: project.id,
                log_level: 'info',
                message: `Fallback storage progress: ${progress.stage} - ${progress.percentage}% - ${progress.message}`
              });
            }
          }
        );

        if (!fallbackStorageResult.success) {
          await supabase.from('generation_logs').insert({
            project_id: project.id,
            log_level: 'error',
            message: `Fallback file storage failed: ${fallbackStorageResult.error}`
          });

          // Update project status to failed
          await supabase
            .from('projects')
            .update({
              status: 'failed',
              ai_provider: 'fallback',
              generation_method: 'failed'
            })
            .eq('id', project.id);

          return NextResponse.json(project);
        }

        // Update project with fallback completion and file information
        await supabase
          .from('projects')
          .update({
            status: 'completed',
            generated_at: new Date().toISOString(),
            ai_provider: 'fallback',
            generation_method: 'template_only',
            file_path: fallbackStorageResult.filePath,
            download_url: fallbackStorageResult.downloadUrl,
            file_size: fallbackStorageResult.fileSize
          })
          .eq('id', project.id);

        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'info',
          message: `Fallback project generation and storage completed! File stored at: ${fallbackStorageResult.filePath}`
        });

      } catch (fallbackError) {
        console.error('Fallback generation also failed:', fallbackError);

        await supabase.from('generation_logs').insert({
          project_id: project.id,
          log_level: 'error',
          message: `Fallback generation failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`
        });

        // Update project status to failed only if fallback also fails
        await supabase
          .from('projects')
          .update({
            status: 'failed',
            ai_provider: 'none',
            generation_method: 'failed'
          })
          .eq('id', project.id);
      }
    }

    return NextResponse.json(project);

  } catch (error) {
    console.error('Create project API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's projects
    const { data: projects, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Database fetch error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    return NextResponse.json(projects);

  } catch (error) {
    console.error('Get projects API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to generate configuration-aware project structure
async function generateConfigAwareProject(
  projectName: string,
  workflow: any,
  nodeConfigs: any[],
  configuration: any
) {
  const files = [];

  // Import the secure code generation modules
  const { configAwareGenerator } = await import('@/lib/code-generation/config-aware-generator');
  const { SecurePackageTemplate } = await import('@/lib/code-generation/secure-package-template');

  // Generate individual node files with embedded configurations using secure templates
  const generationContext = {
    projectName,
    workflowName: workflow.name || projectName,
    nodeConfigs,
    connections: workflow.connections || {}
  };

  for (const nodeConfig of nodeConfigs) {
    if (nodeConfig.nodeType !== 'n8n-nodes-base.stickyNote') { // Skip sticky notes
      const nodeFile = configAwareGenerator.generateNodeImplementation(nodeConfig, generationContext);
      files.push({
        path: nodeFile.filePath,
        content: nodeFile.content
      });
    }
  }

  // Generate secure project files
  const enhancedFiles = await generateSecureProjectFiles(
    projectName,
    workflow,
    nodeConfigs,
    configuration
  );

  files.push(...enhancedFiles);
  return files;
}

// Helper function to generate AI-enhanced project
async function generateAIEnhancedProject(
  projectName: string,
  workflow: any,
  nodeConfigs: any[],
  configuration: any,
  userId: string,
  aiSettings: any,
  aiCodeGenerator: any
) {
  try {

    // Generate base project structure
    const baseFiles = await generateConfigAwareProject(
      projectName,
      workflow,
      nodeConfigs,
      configuration
    );

    let enhancedNodes = 0;
    const enhancedFiles = [];

    // Enhance each node with AI if provider is available and valid
    if (aiSettings?.isValid) {
      console.log(`Starting AI enhancement for ${nodeConfigs.length} nodes with provider: ${aiSettings.provider}`);
      for (const nodeConfig of nodeConfigs) {
        if (nodeConfig.nodeType !== 'n8n-nodes-base.stickyNote') {
          try {
            console.log(`Enhancing node: ${nodeConfig.nodeName} (${nodeConfig.nodeType})`);
            const aiEnhancedNode = await generateAIEnhancedNode(
              nodeConfig,
              workflow,
              projectName,
              aiCodeGenerator,
              userId
            );

            if (aiEnhancedNode.enhanced) {
              console.log(`✅ AI enhancement successful for ${nodeConfig.nodeName}`);
              enhancedFiles.push(aiEnhancedNode.file);
              enhancedNodes++;
            } else {
              console.log(`❌ AI enhancement failed for ${nodeConfig.nodeName}, using base implementation`);
              // Use base implementation if AI enhancement fails
              const baseNode = baseFiles.find(f => f.path.includes(nodeConfig.nodeName));
              if (baseNode) enhancedFiles.push(baseNode);
            }
          } catch (aiError) {
            console.error(`❌ AI enhancement error for node ${nodeConfig.nodeName}:`, aiError);
            // Use base implementation as fallback
            const baseNode = baseFiles.find(f => f.path.includes(nodeConfig.nodeName));
            if (baseNode) enhancedFiles.push(baseNode);
          }
        }
      }
      console.log(`🎯 AI enhancement completed: ${enhancedNodes}/${nodeConfigs.length} nodes enhanced`);
    } else {
      console.log(`⚠️ AI enhancement skipped - Provider: ${aiSettings?.provider}, Valid: ${aiSettings?.isValid}`);
    }

    // Combine enhanced nodes with other project files
    const otherFiles = baseFiles.filter(f =>
      !nodeConfigs.some(config => f.path.includes(config.nodeName))
    );

    return {
      files: [...enhancedFiles, ...otherFiles],
      enhancedNodes,
      aiProvider: aiSettings?.provider || 'system_default',
      totalNodes: nodeConfigs.length
    };

  } catch (error) {
    console.error('AI-enhanced project generation failed:', error);
    // Fallback to base generation
    const baseFiles = await generateConfigAwareProject(
      projectName,
      workflow,
      nodeConfigs,
      configuration
    );

    return {
      files: baseFiles,
      enhancedNodes: 0,
      aiProvider: 'fallback',
      totalNodes: nodeConfigs.length,
      error: error.message
    };
  }
}

// Helper function to generate AI-enhanced individual node
async function generateAIEnhancedNode(
  nodeConfig: any,
  workflow: any,
  projectName: string,
  aiCodeGenerator: any,
  userId: string
) {
  const className = nodeConfig.nodeName.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Node').replace(/^./, (str: string) => str.toUpperCase()) + 'Node';

  // Create AI prompt for node enhancement
  const prompt = `
Generate a complete, production-ready Node.js implementation for this n8n workflow node:

**Node Details:**
- Name: ${nodeConfig.nodeName}
- Type: ${nodeConfig.nodeType}
- Workflow: ${workflow.name || projectName}

**Node Configuration:**
${JSON.stringify(nodeConfig.configuredParameters, null, 2)}

**Environment Variables:**
${nodeConfig.environmentVariables.map((env: any) => `- ${env.key}: ${env.description || 'Configuration value'}`).join('\n')}

**Requirements:**
1. Create a class named "${className}" that extends BaseNode
2. Implement the execute() method with proper error handling
3. Use the exact configuration values provided in the node parameters
4. Include comprehensive JSDoc documentation
5. Add input validation and type checking
6. Implement retry logic for network operations
7. Use environment variables for credentials (${nodeConfig.environmentVariables.map((env: any) => env.key).join(', ')})
8. Return structured output compatible with n8n data format
9. Include detailed logging for debugging
10. Handle edge cases and provide meaningful error messages

**Code Style:**
- Use modern ES6+ JavaScript with async/await
- Follow Node.js best practices
- Include comprehensive error handling
- Use descriptive variable names
- Add performance optimizations where applicable

Generate ONLY the complete JavaScript class implementation, no explanations or markdown formatting.
`;

  try {
    console.log(`🤖 Calling AI generator for ${nodeConfig.nodeName}...`);
    // Call AI code generator to generate enhanced code
    const aiResult = await aiCodeGenerator.generateCode(userId, prompt, {
      nodeType: nodeConfig.nodeType,
      nodeName: nodeConfig.nodeName,
      parameters: nodeConfig.configuredParameters,
      workflowName: workflow.name,
      projectName: projectName
    });
    
    console.log(`🤖 AI result for ${nodeConfig.nodeName}:`, {
      success: aiResult.success,
      provider: aiResult.provider,
      fallbackUsed: aiResult.fallbackUsed,
      codeLength: aiResult.code?.length || 0,
      error: aiResult.error
    });

    if (aiResult.success && aiResult.code && aiResult.code.trim().length > 200) {
      const enhancedContent = `/**
 * AI-Enhanced Node Implementation: ${nodeConfig.nodeName}
 * Type: ${nodeConfig.nodeType}
 * Generated with AI provider: ${aiResult.provider}
 * Fallback used: ${aiResult.fallbackUsed}
 * 
 * Configuration Parameters: ${nodeConfig.configuredParameters.length}
 * Environment Variables: ${nodeConfig.environmentVariables.length}
 */

${aiResult.code}

export default ${className};`;

      return {
        enhanced: true,
        file: {
          path: `src/nodes/${className}.js`,
          content: enhancedContent
        },
        provider: aiResult.provider,
        fallbackUsed: aiResult.fallbackUsed
      };
    } else {
      console.warn(`AI generation failed for ${nodeConfig.nodeName}: ${aiResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.warn(`AI enhancement failed for ${nodeConfig.nodeName}:`, error);
  }

  return { enhanced: false };
}


// Helper function to validate AI-generated code
async function validateGeneratedCode(aiProject: any) {
  const errors = [];

  try {
    // Basic validation checks
    if (!aiProject.files || !Array.isArray(aiProject.files)) {
      errors.push('Invalid project structure: missing files array');
    }

    if (aiProject.files.length === 0) {
      errors.push('No files generated');
    }

    // Validate each file
    for (const file of aiProject.files) {
      if (!file.path || !file.content) {
        errors.push(`Invalid file structure: ${file.path || 'unknown'}`);
        continue;
      }

      // Basic syntax validation for JavaScript files
      if (file.path.endsWith('.js')) {
        try {
          // Check for basic JavaScript syntax issues
          if (!file.content.includes('class ') && !file.content.includes('function ') && !file.content.includes('export ')) {
            errors.push(`JavaScript file appears to be empty or invalid: ${file.path}`);
          }

          // Check for common syntax errors
          const openBraces = (file.content.match(/{/g) || []).length;
          const closeBraces = (file.content.match(/}/g) || []).length;
          if (openBraces !== closeBraces) {
            errors.push(`Mismatched braces in file: ${file.path}`);
          }

          // Check for export statement
          if (!file.content.includes('export ')) {
            errors.push(`Missing export statement in file: ${file.path}`);
          }
        } catch (syntaxError) {
          errors.push(`Syntax validation failed for ${file.path}: ${syntaxError.message}`);
        }
      }

      // Validate JSON files
      if (file.path.endsWith('.json')) {
        try {
          JSON.parse(file.content);
        } catch (jsonError) {
          errors.push(`Invalid JSON in file ${file.path}: ${jsonError.message}`);
        }
      }
    }

    // Check for required files
    const requiredFiles = ['package.json', 'main.js', '.env.example', 'README.md'];
    for (const requiredFile of requiredFiles) {
      if (!aiProject.files.some((f: any) => f.path === requiredFile)) {
        errors.push(`Missing required file: ${requiredFile}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      fileCount: aiProject.files.length,
      enhancedNodes: aiProject.enhancedNodes || 0
    };

  } catch (error) {
    return {
      isValid: false,
      errors: [`Validation error: ${error.message}`],
      fileCount: 0,
      enhancedNodes: 0
    };
  }
}

// Helper function to generate secure project files
async function generateSecureProjectFiles(
  projectName: string,
  workflow: any,
  nodeConfigs: any[],
  configuration: any
) {
  const files = [];

  // Import secure package template
  const { SecurePackageTemplate } = await import('@/lib/code-generation/secure-package-template');

  // Analyze workflow nodes and their configurations
  const nodes = workflow.nodes || [];
  const nodeTypes = nodes.map((node: any) => node.type);
  const uniqueNodeTypes = Array.from(new Set(nodeTypes));
  const triggerNodes = nodes.filter((node: any) =>
    node.type?.includes('trigger') || node.type?.includes('Trigger')
  );

  // Collect all dependencies from node configurations (filtered for security)
  const allDependencies = new Set<string>();
  const allEnvVars = new Set<string>();

  for (const nodeConfig of nodeConfigs) {
    // Filter out vulnerable dependencies
    const safeDependencies = nodeConfig.dependencies.filter((dep: string) =>
      !['vm2', 'eval', 'child_process'].some(unsafe => dep.includes(unsafe))
    );
    safeDependencies.forEach((dep: string) => allDependencies.add(dep));
    nodeConfig.environmentVariables.forEach((env: any) => allEnvVars.add(env.key));
  }

  // Add basic secure dependencies
  allDependencies.add('dotenv');
  if (nodeTypes.some(type => type.includes('httpRequest'))) {
    allDependencies.add('axios');
  }
  if (nodeTypes.some(type => type.includes('webhook'))) {
    allDependencies.add('express');
  }

  // Generate secure package.json using the secure template
  const packageConfig = {
    projectName,
    description: `Generated from n8n workflow: ${workflow.name || projectName}`,
    nodeVersion: configuration?.nodeVersion || '18',
    packageManager: configuration?.packageManager || 'npm',
    dependencies: Array.from(allDependencies),
    environmentVariables: Array.from(allEnvVars)
  };

  files.push({
    path: 'package.json',
    content: SecurePackageTemplate.generatePackageJson(packageConfig)
  });

  // Generate environment validation script
  files.push({
    path: 'scripts/validate-env.js',
    content: SecurePackageTemplate.generateEnvValidationScript(Array.from(allEnvVars))
  });

  // Generate secure .env.example
  files.push({
    path: '.env.example',
    content: SecurePackageTemplate.generateEnvExample(Array.from(allEnvVars))
  });

  // Generate secure README with security notes
  files.push({
    path: 'README.md',
    content: SecurePackageTemplate.generateSecureReadme(packageConfig)
  });

  // Generate main.js with configuration-aware workflow execution
  const executableNodes = nodeConfigs.filter(config => config.nodeType !== 'n8n-nodes-base.stickyNote');
  const nodeImports = executableNodes
    .map(config => {
      const className = config.nodeName.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Node$&').replace(/^./, (str: string) => str.toUpperCase()) + 'Node';
      return `import ${className} from './src/nodes/${className}.js';`;
    }).join('\n');

  const nodeInstantiations = executableNodes
    .map(config => {
      const className = config.nodeName.replace(/[^a-zA-Z0-9]/g, '').replace(/^\d/, 'Node$&').replace(/^./, (str: string) => str.toUpperCase()) + 'Node';
      return `    nodes.set('${config.nodeId}', new ${className}());`;
    }).join('\n');

  files.push({
    path: 'main.js',
    content: `#!/usr/bin/env node

/**
 * Configuration-Aware n8n Workflow Execution
 * Generated from: ${workflow.name || projectName}
 * Nodes: ${workflow.nodes?.length || 0} (${nodeConfigs.length} executable)
 * Generated: ${new Date().toISOString()}
 * 
 * This file contains the exact node configurations from your n8n workflow
 */

import { config } from 'dotenv';
import { WorkflowExecutor } from './src/workflow/WorkflowExecutor.js';

${nodeImports}

// Load environment variables
config();

console.log('🚀 Starting Configuration-Aware n8n Workflow');
console.log('📋 Workflow:', '${workflow.name || projectName}');
console.log('📊 Statistics:');
console.log('  - Total Nodes:', ${workflow.nodes?.length || 0});
console.log('  - Executable Nodes:', ${executableNodes.length});
console.log('  - Trigger Nodes:', ${triggerNodes.length});
console.log('  - Environment Variables Required:', ${Array.from(allEnvVars).length});

// Initialize nodes with their exact configurations
const nodes = new Map();
${nodeInstantiations}

// Workflow execution with configuration
async function executeWorkflow() {
  try {
    console.log('\\n⚡ Initializing workflow executor...');
    
    const executor = new WorkflowExecutor({
      nodes,
      connections: ${JSON.stringify(workflow.connections || {}, null, 2)},
      workflowName: '${workflow.name || projectName}',
      executionMode: 'standalone'
    });
    
    console.log('\\n🔄 Executing workflow with configured parameters...');
    const result = await executor.execute();
    
    console.log('\\n✅ Workflow execution completed successfully');
    console.log('📈 Execution Summary:');
    console.log('  - Nodes Executed:', result.nodesExecuted || 0);
    console.log('  - Execution Time:', result.executionTime || 0, 'ms');
    console.log('  - Success Rate:', result.successRate || '100%');
    
    return result;
  } catch (error) {
    console.error('\\n❌ Workflow execution failed:', error.message);
    console.error('🔍 Error Details:', error.stack);
    return { success: false, error: error.message };
  }
}

// Validate environment variables before execution
function validateEnvironment() {
  const requiredVars = [${Array.from(allEnvVars).map(v => `'${v}'`).join(', ')}];
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(varName => console.error('  -', varName));
    console.error('\\n💡 Please check your .env file and ensure all variables are set.');
    return false;
  }
  
  console.log('✅ All required environment variables are configured');
  return true;
}

// Main execution
async function main() {
  console.log('\\n🔍 Validating environment configuration...');
  
  if (!validateEnvironment()) {
    process.exit(1);
  }
  
  const result = await executeWorkflow();
  
  console.log('\\n📋 Final Result:', {
    success: result.success,
    message: result.message || result.error,
    timestamp: new Date().toISOString()
  });
  
  process.exit(result.success ? 0 : 1);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\\n🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\\n🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start execution
main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
`
  });

  // Generate .env.example with actual required environment variables
  const envVarEntries = Array.from(allEnvVars).map(envVar => {
    const nodeConfig = nodeConfigs.find(config =>
      config.environmentVariables.some((env: any) => env.key === envVar)
    );
    const envConfig = nodeConfig?.environmentVariables.find((env: any) => env.key === envVar);

    return `# ${envConfig?.description || `Configuration for ${envVar}`}
${envVar}=${envConfig?.example || 'your_value_here'}`;
  }).join('\n\n');

  files.push({
    path: '.env.example',
    content: `# Environment Variables for ${projectName}
# Copy this file to .env and fill in your actual values
# Generated from n8n workflow: ${workflow.name || projectName}

# Basic Configuration
NODE_ENV=development
LOG_LEVEL=info
EXECUTION_MODE=standalone

# Workflow-specific Environment Variables
# These are required based on your n8n node configurations

${envVarEntries}

# Optional Configuration
# EXECUTION_TIMEOUT=300000
# EXECUTION_RETRIES=3
# WEBHOOK_PORT=3001

# Generated from ${nodeConfigs.length} configured nodes
# Node types: ${uniqueNodeTypes.join(', ')}
`
  });

  // Generate README.md with detailed information
  files.push({
    path: 'README.md',
    content: `# ${projectName}

Generated from n8n workflow using the n8n Workflow Converter.

## 📋 Workflow Information

- **Name**: ${workflow.name || 'Unnamed Workflow'}
- **Total Nodes**: ${workflow.nodes?.length || 0}
- **Trigger Nodes**: ${triggerNodes.length}
- **Unique Node Types**: ${uniqueNodeTypes.length}
- **Generated**: ${new Date().toISOString()}

## 🔧 Node Types Used

${uniqueNodeTypes.map((type: string) => `- \`${type}\``).join('\n')}

## 🚀 Quick Start

### Installation

\`\`\`bash
npm install
\`\`\`

### Configuration

1. Copy the environment file:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

2. Edit \`.env\` and add your API keys and configuration values.

### Running the Workflow

\`\`\`bash
# Production mode
npm start

# Development mode (with auto-restart)
npm run dev
\`\`\`

## 📁 Project Structure

\`\`\`
${projectName}/
├── main.js              # Main workflow execution file
├── package.json         # Dependencies and scripts
├── .env.example         # Environment variables template
├── .env                 # Your actual environment variables (create this)
└── README.md           # This file
\`\`\`

## 🔄 Workflow Execution Flow

${nodes.map((node: any, index: number) =>
      `${index + 1}. **${node.name}** (\`${node.type}\`)`
    ).join('\n')}

## ⚠️ Important Notes

- This is a **basic generated structure** from your n8n workflow
- **Manual implementation required**: The actual node logic needs to be implemented
- **Credentials**: Configure your API keys and credentials in the \`.env\` file
- **Dependencies**: Additional packages may be needed based on your specific use case

## 🛠️ Next Steps

1. **Review the generated code** and understand the workflow structure
2. **Implement node logic** in the main.js file or create separate node files
3. **Configure credentials** and environment variables
4. **Test the workflow** with your actual data
5. **Add error handling** and logging as needed

## 📚 Resources

- [n8n Documentation](https://docs.n8n.io/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [n8n Workflow Converter](https://github.com/your-repo/n8n-workflow-converter)

## 📄 License

MIT License - Generated by n8n Workflow Converter

---

**Generated on**: ${new Date().toISOString()}  
**Original Workflow**: ${workflow.name || 'Unnamed Workflow'}  
**Converter Version**: 1.0.0
`
  });

  // Generate .gitignore
  files.push({
    path: '.gitignore',
    content: `# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.production

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/

# nyc test coverage
.nyc_output

# Dependency directories
node_modules/
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env

# IDE files
.vscode/
.idea/
*.swp
*.swo

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
`
  });

  // Add base classes and workflow executor
  files.push({
    path: 'src/base/BaseNode.js',
    content: `// Base Node Class for all generated nodes
export class BaseNode {
  constructor() {
    this.nodeType = '';
    this.nodeName = '';
    this.nodeId = '';
    this.credentials = {};
    this.executionStartTime = 0;
    this.executionLogs = [];
  }

  log(level, message, data) {
    const timestamp = new Date().toISOString();
    const logMessage = \`[\${timestamp}] \${level.toUpperCase()} [\${this.nodeName}]: \${message}\`;
    this.executionLogs.push(logMessage);
    console.log(logMessage, data || '');
  }

  startExecution() {
    this.executionStartTime = Date.now();
    this.log('info', 'Starting execution');
  }

  endExecution() {
    const executionTime = Date.now() - this.executionStartTime;
    this.log('info', \`Execution completed in \${executionTime}ms\`);
    return executionTime;
  }

  getParameter(name, defaultValue) {
    return this[name] !== undefined ? this[name] : defaultValue;
  }

  validateRequiredParameters(requiredParams) {
    const missing = requiredParams.filter(param => 
      this[param] === undefined || this[param] === null
    );
    if (missing.length > 0) {
      throw new Error(\`Missing required parameters: \${missing.join(', ')}\`);
    }
  }

  processInputData(inputData) {
    if (!inputData) return [{}];
    if (Array.isArray(inputData)) return inputData;
    return [inputData];
  }

  formatOutputData(data) {
    if (data === null || data === undefined) return {};
    return data;
  }

  handleError(error, context) {
    const errorMessage = context ? \`\${context}: \${error.message}\` : error.message;
    this.log('error', errorMessage, { stack: error.stack });
    throw new Error(\`\${this.nodeName} execution failed: \${errorMessage}\`);
  }
}`
  });

  files.push({
    path: 'src/workflow/WorkflowExecutor.js',
    content: `// Configuration-Aware Workflow Executor
export class WorkflowExecutor {
  constructor(config) {
    this.config = config;
    this.executionId = this.generateExecutionId();
    this.executionStartTime = 0;
    this.nodeResults = new Map();
    this.executionErrors = [];
  }

  async execute() {
    this.executionStartTime = Date.now();
    
    try {
      console.log(\`🚀 Starting workflow execution: \${this.config.workflowName}\`);
      
      const executionOrder = this.calculateExecutionOrder();
      console.log(\`🔄 Execution order: \${executionOrder.join(' → ')}\`);
      
      let successfulNodes = 0;
      
      for (const nodeId of executionOrder) {
        try {
          await this.executeNode(nodeId);
          successfulNodes++;
        } catch (error) {
          const errorMessage = \`Node \${nodeId} failed: \${error.message}\`;
          this.executionErrors.push(errorMessage);
          console.error(\`❌ \${errorMessage}\`);
          continue;
        }
      }
      
      const executionTime = Date.now() - this.executionStartTime;
      const successRate = executionOrder.length > 0 
        ? \`\${Math.round((successfulNodes / executionOrder.length) * 100)}%\`
        : '0%';
      
      return {
        success: this.executionErrors.length === 0,
        nodesExecuted: successfulNodes,
        executionTime,
        successRate,
        results: Object.fromEntries(this.nodeResults),
        errors: this.executionErrors,
        message: \`Executed \${successfulNodes} nodes successfully\`
      };
      
    } catch (error) {
      const executionTime = Date.now() - this.executionStartTime;
      return {
        success: false,
        nodesExecuted: 0,
        executionTime,
        successRate: '0%',
        results: {},
        errors: [error.message],
        error: error.message
      };
    }
  }

  async executeNode(nodeId) {
    const node = this.config.nodes.get(nodeId);
    if (!node) {
      throw new Error(\`Node \${nodeId} not found\`);
    }

    console.log(\`⚡ Executing node: \${node.nodeName} (\${node.nodeType})\`);
    
    const inputData = this.getInputData(nodeId);
    const context = {
      workflow: { name: this.config.workflowName, executionId: this.executionId },
      executionId: this.executionId,
      nodeId: nodeId,
      mode: this.config.executionMode,
      getNodeOutput: (id) => this.nodeResults.get(id),
      setNodeOutput: (id, data) => this.nodeResults.set(id, data)
    };

    const startTime = Date.now();
    const result = await node.execute(inputData, context);
    const executionTime = Date.now() - startTime;
    
    this.nodeResults.set(nodeId, result);
    console.log(\`✅ Node completed: \${node.nodeName} (\${executionTime}ms)\`);
  }

  getInputData(nodeId) {
    const connections = this.config.connections;
    const inputData = [];

    for (const [sourceNodeId, sourceConnections] of Object.entries(connections)) {
      if (sourceConnections && typeof sourceConnections === 'object') {
        for (const [outputType, connectionList] of Object.entries(sourceConnections)) {
          if (Array.isArray(connectionList)) {
            for (const connection of connectionList) {
              if (connection.node === nodeId) {
                const sourceResult = this.nodeResults.get(sourceNodeId);
                if (sourceResult !== undefined) {
                  inputData.push(sourceResult);
                }
              }
            }
          }
        }
      }
    }

    if (inputData.length === 0) return {};
    if (inputData.length === 1) return inputData[0];
    return inputData;
  }

  calculateExecutionOrder() {
    const nodes = Array.from(this.config.nodes.keys());
    const connections = this.config.connections;
    
    const graph = new Map();
    const inDegree = new Map();
    
    nodes.forEach(nodeId => {
      graph.set(nodeId, []);
      inDegree.set(nodeId, 0);
    });
    
    for (const [sourceNodeId, sourceConnections] of Object.entries(connections)) {
      if (sourceConnections && typeof sourceConnections === 'object') {
        for (const [outputType, connectionList] of Object.entries(sourceConnections)) {
          if (Array.isArray(connectionList)) {
            for (const connection of connectionList) {
              const targetNodeId = connection.node;
              if (graph.has(sourceNodeId) && graph.has(targetNodeId)) {
                graph.get(sourceNodeId).push(targetNodeId);
                inDegree.set(targetNodeId, inDegree.get(targetNodeId) + 1);
              }
            }
          }
        }
      }
    }
    
    const queue = [];
    const result = [];
    
    inDegree.forEach((degree, nodeId) => {
      if (degree === 0) queue.push(nodeId);
    });
    
    while (queue.length > 0) {
      const currentNode = queue.shift();
      result.push(currentNode);
      
      const neighbors = graph.get(currentNode) || [];
      for (const neighbor of neighbors) {
        const newDegree = inDegree.get(neighbor) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }
    
    if (result.length !== nodes.length) {
      console.warn('⚠️ Circular dependency detected, using fallback order');
      return nodes;
    }
    
    return result;
  }

  generateExecutionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return \`exec_\${timestamp}_\${random}\`;
  }
}`
  });

  return files;
}