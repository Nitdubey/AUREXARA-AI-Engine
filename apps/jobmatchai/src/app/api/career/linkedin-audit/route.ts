import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { linkedinProfileText } = await req.json();

    // Reasoning task: Sonnet audits the full profile
    const audit = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert LinkedIn profile optimizer. Analyze the provided LinkedIn profile text. Output valid JSON: { "score": 80, "headlineSuggestions": ["Option 1", "Option 2"], "summaryFeedback": "Feedback here", "actionItems": ["Action 1", "Action 2"] }'
        },
        {
          role: 'user',
          content: linkedinProfileText
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'writing' },
      temperature: 0.5
    });

    return NextResponse.json({ success: true, audit: safeParseLLMJson(audit.content) });
  } catch (error) {
    console.error('LinkedIn audit failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
