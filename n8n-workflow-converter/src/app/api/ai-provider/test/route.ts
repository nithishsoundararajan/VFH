import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIProviderService } from '@/lib/services/ai-provider-service';
import { AIProvider } from '@/lib/ai-providers';

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, apiKey } = await request.json();

    if (!provider || !apiKey) {
      return NextResponse.json({ error: 'Provider and API key are required' }, { status: 400 });
    }

    if (!Object.values(['openai', 'anthropic', 'gemini', 'openrouter']).includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const aiProviderService = new AIProviderService();
    const isValid = await aiProviderService.testApiKey(provider as AIProvider, apiKey);

    return NextResponse.json({ isValid });
  } catch (error) {
    console.error('Failed to test API key:', error);
    return NextResponse.json(
      { error: 'Failed to test API key' },
      { status: 500 }
    );
  }
}