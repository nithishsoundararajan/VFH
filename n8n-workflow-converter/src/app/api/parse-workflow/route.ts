import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface WorkflowParseRequest {
  fileData: string; // Base64 encoded file data
  fileName: string;
  userId: string;
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

    const body: WorkflowParseRequest = await request.json();
    const { fileData, fileName, userId } = body;

    // Validate that the user ID matches the authenticated user
    if (userId !== user.id) {
      return NextResponse.json(
        { error: 'Unauthorized - user ID mismatch' },
        { status: 401 }
      );
    }

    // Get the authorization header to pass to the Edge Function
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Parse workflow directly (simplified version for testing)
    try {
      // Decode base64 file data
      const fileBuffer = Buffer.from(fileData, 'base64');
      const jsonString = fileBuffer.toString('utf-8');
      const workflowData = JSON.parse(jsonString);

      // Validate n8n workflow structure
      if (!workflowData.nodes || !Array.isArray(workflowData.nodes)) {
        return NextResponse.json({
          success: false,
          securityStatus: { safe: false, message: 'Invalid n8n workflow: missing or invalid nodes array' },
          error: 'Invalid n8n workflow format'
        });
      }

      // Extract metadata
      const nodes = workflowData.nodes || [];
      const connections = workflowData.connections || {};
      const triggers = nodes.filter((node: any) =>
        node.type?.includes('trigger') || node.type?.includes('Trigger')
      );

      const nodeTypes = [...new Set(nodes.map((node: any) => node.type))] as string[];
      const hasCredentials = nodes.some((node: any) =>
        node.credentials && Object.keys(node.credentials).length > 0
      );

      const metadata = {
        name: workflowData.name || fileName.replace('.json', ''),
        nodeCount: nodes.length,
        triggerCount: triggers.length,
        connections: Object.keys(connections).length,
        nodeTypes,
        hasCredentials
      };

      // Sanitize workflow data (remove sensitive information)
      const sanitizedData = {
        ...workflowData,
        nodes: nodes.map((node: any) => ({
          ...node,
          // Remove credential values but keep credential names for mapping
          credentials: node.credentials ?
            Object.keys(node.credentials).reduce((acc: any, key: string) => {
              acc[key] = '[CREDENTIAL_PLACEHOLDER]';
              return acc;
            }, {}) : undefined
        }))
      };

      // For now, we'll skip VirusTotal scanning and assume files are safe
      // In production, you would implement proper security scanning here
      const securityStatus = {
        safe: true,
        message: 'Basic validation passed (security scanning disabled for testing)'
      };

      // Log successful parsing
      await supabase.from('generation_logs').insert({
        project_id: null, // Will be set when project is created
        log_level: 'info',
        message: `Workflow parsed successfully: ${metadata.nodeCount} nodes, ${metadata.triggerCount} triggers`
      });

      return NextResponse.json({
        success: true,
        securityStatus,
        workflow: { metadata, sanitizedData }
      });

    } catch (parseError) {
      console.error('JSON parsing error:', parseError);
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parsing error';

      // Log parsing error
      await supabase.from('generation_logs').insert({
        project_id: null,
        log_level: 'error',
        message: `Workflow parsing failed: ${errorMessage}`
      });

      return NextResponse.json({
        success: false,
        securityStatus: { safe: false, message: 'File parsing failed' },
        error: `Invalid JSON format: ${errorMessage}`
      });
    }

  } catch (error) {
    console.error('Parse workflow API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    },
  });
}