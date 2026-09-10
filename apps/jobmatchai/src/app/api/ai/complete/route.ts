/**
 * AUREXARA Engine — Raw AI Completions Pass-through
 * POST /api/ai/complete
 *
 * Accepts jobmatchai's own messages/system-prompts and routes them
 * to the correct Arsenal specialist model via Bedrock Mantle.
 * Returns raw content so jobmatchai can parse with its own schema.
 */
import { NextResponse } from 'next/server';
import { AurexaraClient } from '@aurexara/engine';

// Task → Arsenal specialist model mapping
const TASK_MODEL_MAP: Record<string, string> = {
  jd_match:                'nvidia.nemotron-super-3-120b',
  jd_arsenal:              'nvidia.nemotron-super-3-120b',
  should_apply:            'deepseek.v3.2',
  skill_gap:               'deepseek.v3.2',
  resume_rewrite:          'mistral.mistral-large-3-675b-instruct',
  builder_enhance:         'mistral.mistral-large-3-675b-instruct',
  builder_generate:        'nvidia.nemotron-nano-3-30b',
  resume_parse:            'qwen.qwen3-235b-a22b-2507',
  follow_up_email:         'nvidia.nemotron-nano-3-30b',
  mock_interview:          'openai.gpt-oss-120b',
  interview_prep:          'mistral.mistral-large-3-675b-instruct',
  negotiate:               'openai.gpt-oss-120b',
  linkedin_audit_generate: 'mistral.mistral-large-3-675b-instruct',
  linkedin_optimize:       'mistral.mistral-large-3-675b-instruct',
  rejection_analysis:      'openai.gpt-oss-120b',
  agent_score:             'nvidia.nemotron-nano-3-30b',
  agent_evolve:            'deepseek.v3.2',
  seo_generate:            'nvidia.nemotron-nano-3-30b',
  blog_generate:           'mistral.mistral-large-3-675b-instruct',
  community_generate:      'nvidia.nemotron-nano-3-30b',
  default:                 'deepseek.v3.2',
};

const engine = AurexaraClient.fromEnv('jobmatchai');

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      taskType?: string;
      temperature?: number;
      maxTokens?: number;
    };

    const { messages, taskType = 'default', temperature, maxTokens } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'messages array is required' }, { status: 400 });
    }

    const targetModel = TASK_MODEL_MAP[taskType] ?? TASK_MODEL_MAP['default'];

    const typedMessages = messages.map(m => ({
      role: (m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system') as
        'user' | 'assistant' | 'system',
      content: String(m.content),
    }));

    const result = await engine.models.complete({
      messages: typedMessages,
      model: targetModel,
      temperature,
      maxTokens,
    });

    return NextResponse.json({
      content: result.content,
      model: result.model,
      cost: result.cost,
    });

  } catch (error) {
    console.error('[AUREXARA /api/ai/complete]', error);
    return NextResponse.json(
      { error: 'AI completion failed', details: String(error) },
      { status: 500 }
    );
  }
}
