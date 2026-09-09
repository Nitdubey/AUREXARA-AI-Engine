import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { profile, goal } = await req.json();

    // Reasoning task: Sonnet generates a step-by-step career roadmap
    const roadmap = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an elite career copilot. Given a user\'s current profile and their target career goal, generate a highly actionable, month-by-month roadmap to achieve it. Output valid JSON: { "roadmap": [ { "month": 1, "focus": "Skill building", "actionItems": ["Learn X", "Build Y"] } ], "criticalAdvice": "Overall tip" }'
        },
        {
          role: 'user',
          content: `Current Profile:\n${JSON.stringify(profile)}\n\nCareer Goal:\n${goal}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'reasoning' },
      temperature: 0.7 
    });

    return NextResponse.json({ success: true, plan: safeParseLLMJson(roadmap.content) });
  } catch (error) {
    console.error('Career Copilot failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
