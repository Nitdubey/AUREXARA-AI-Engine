import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { profile, jobDescription } = await req.json();

    if (!profile || !jobDescription) {
      return NextResponse.json({ error: 'Profile and Job Description are required' }, { status: 400 });
    }

    // Reasoning task: Sonnet evaluates the profile against JD
    const analysis = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an objective career advisor. Analyze the candidate\'s profile against the job description. Output valid JSON: { "shouldApply": true/false, "matchScore": 85, "reasoning": "Why they should or should not apply", "dealbreakers": ["Missing required skill X"] }'
        },
        {
          role: 'user',
          content: `Candidate Profile:\n${JSON.stringify(profile)}\n\nJob Description:\n${jobDescription}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'reasoning' },
      temperature: 0.2 // Low temperature for objective scoring
    });

    return NextResponse.json({ success: true, result: safeParseLLMJson(analysis.content) });
  } catch (error) {
    console.error('Should I apply analysis failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
