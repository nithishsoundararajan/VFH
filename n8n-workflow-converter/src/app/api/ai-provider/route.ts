import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { AIProviderService } from '@/lib/services/ai-provider-service';
import { AIProvider } from '@/lib/ai-providers';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiProviderService = new AIProviderService();
    const settings = await aiProviderService.getUserSettings(user.id);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Failed to get AI provider settings:', error);
    return NextResponse.json(
      { error: 'Failed to get AI provider settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, apiKey } = await request.json();

    if (!provider || !Object.values(['openai', 'anthropic', 'gemini', 'openrouter', 'system_default']).includes(provider)) {
      return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }

    const aiProviderService = new AIProviderService();
    await aiProviderService.updateUserSettings(user.id, provider as AIProvider, apiKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update AI provider settings:', error);
    return NextResponse.json(
      { error: 'Failed to update AI provider settings' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const aiProviderService = new AIProviderService();
    await aiProviderService.clearUserSettings(user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear AI provider settings:', error);
    return NextResponse.json(
      { error: 'Failed to clear AI provider settings' },
      { status: 500 }
    );
  }
}