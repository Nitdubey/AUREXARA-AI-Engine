import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { company, role, jobDescription } = await req.json();

    // Reasoning task: Sonnet generates interview strategy
    const prep = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an interview preparation coach. Based on the company, role, and JD, generate the 5 most likely interview questions, expected answers, and a preparation strategy. Output valid JSON: { "strategy": "Overall approach", "questions": [ { "q": "Question", "rationale": "Why they ask this", "tips": "How to answer" } ] }'
        },
        {
          role: 'user',
          content: `Company: ${company}\nRole: ${role}\nJD: ${jobDescription}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'writing' },
      temperature: 0.6 
    });

    return NextResponse.json({ success: true, prepData: safeParseLLMJson(prep.content) });
  } catch (error) {
    console.error('Interview prep failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
