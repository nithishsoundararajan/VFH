import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ConfigurationValidator } from '@/lib/validation/configuration';

interface UpdateConfigurationRequest {
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
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const projectId = params.id;
    const body: UpdateConfigurationRequest = await request.json();

    // Validate project ownership
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id, name')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Sanitize and validate configuration
    try {
      // Sanitize configuration using the validation utility
      const sanitizedConfiguration = ConfigurationValidator.sanitizeConfiguration(body);

      // Validate configuration
      const validationErrors = ConfigurationValidator.validateConfiguration(sanitizedConfiguration);
      if (validationErrors.length > 0) {
        const errorMessage = validationErrors.map(err => `${err.field}: ${err.message}`).join(', ');
        return NextResponse.json(
          { error: `Configuration validation failed: ${errorMessage}` },
          { status: 400 }
        );
      }

      // Update project configuration
      const { data: updatedProject, error: updateError } = await supabase
        .from('projects')
        .update({
          configuration: sanitizedConfiguration,
          updated_at: new Date().toISOString()
        })
        .eq('id', projectId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Configuration update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update configuration' },
          { status: 500 }
        );
      }

      // Log configuration update
      await supabase.from('generation_logs').insert({
        project_id: projectId,
        log_level: 'info',
        message: `Project configuration updated for "${sanitizedConfiguration.projectName}"`
      });

      return NextResponse.json({
        message: 'Configuration updated successfully',
        project: updatedProject
      });

    } catch (validationError) {
      console.error('Configuration validation error:', validationError);
      return NextResponse.json(
        { error: 'Invalid configuration data' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('Update configuration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const projectId = params.id;

    // Get project configuration
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, description, configuration, created_at, updated_at')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single();

    if (projectError || !project) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: project.id,
      name: project.name,
      description: project.description,
      configuration: project.configuration,
      created_at: project.created_at,
      updated_at: project.updated_at
    });

  } catch (error) {
    console.error('Get configuration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}