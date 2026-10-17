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

// Task → Arsenal specialist model mapping (Plan 2 — 6-Specialist Arsenal)
const TASK_MODEL_MAP: Record<string, string> = {
  // 1. Sprinter (Nemotron Nano 30B)
  follow_up_email:         'nvidia.nemotron-nano-3-30b',
  agent_score:             'nvidia.nemotron-nano-3-30b',
  community_generate:      'nvidia.nemotron-nano-3-30b',

  // 2. ATS & Fast Matcher (Nemotron Super 120B)
  jd_match:                'nvidia.nemotron-super-3-120b',
  jd_arsenal:              'nvidia.nemotron-super-3-120b',
  builder_generate:        'nvidia.nemotron-super-3-120b',
  analyze_gaps:            'nvidia.nemotron-super-3-120b',

  // 3. JSON Extractor (Qwen3 235B)
  resume_parse:            'qwen.qwen3-235b-a22b-2507',

  // 4. Conversationalist (GPT-OSS 120B)
  mock_interview:          'openai.gpt-oss-120b',
  negotiate:               'openai.gpt-oss-120b',
  rejection_analysis:      'openai.gpt-oss-120b',

  // 5. Strategist (DeepSeek V3.2 685B)
  should_apply:            'deepseek.v3.2',
  skill_gap:               'deepseek.v3.2',
  interview_prep:          'deepseek.v3.2',
  agent_evolve:            'deepseek.v3.2',

  // 6. Master Writer (Mistral Large 3 675B)
  resume_rewrite:          'mistral.mistral-large-3-675b-instruct',
  builder_enhance:         'mistral.mistral-large-3-675b-instruct',
  cover_letter:            'mistral.mistral-large-3-675b-instruct',
  linkedin_audit_generate: 'mistral.mistral-large-3-675b-instruct',
  linkedin_optimize:       'mistral.mistral-large-3-675b-instruct',
  seo_generate:            'mistral.mistral-large-3-675b-instruct',
  blog_generate:           'mistral.mistral-large-3-675b-instruct',
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
