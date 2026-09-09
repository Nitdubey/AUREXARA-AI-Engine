import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { company, role, rejectionEmailText, profile } = await req.json();

    // Reasoning task: Sonnet provides empathetic and actionable analysis
    const analysis = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an empathetic but strategic career coach. Analyze the rejection scenario. Output valid JSON: { "possibleReasons": ["Reason 1"], "silverLining": "Empathetic positive note", "nextSteps": ["Step 1"], "followUpEmailTemplate": "Optional email to reply to the rejection asking for feedback" }'
        },
        {
          role: 'user',
          content: `Company: ${company}\nRole: ${role}\nRejection Email:\n${rejectionEmailText || 'Standard template'}\nCandidate Profile:\n${JSON.stringify(profile)}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'conversation' },
      temperature: 0.6 
    });

    return NextResponse.json({ success: true, analysis: safeParseLLMJson(analysis.content) });
  } catch (error) {
    console.error('Rejection analysis failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
