import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Resume and Job Description are required' }, { status: 400 });
    }

    // Analysis task: 'reasoning' hint selects Sonnet for actionable advice
    const analysis = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert career strategist. Compare the candidate\'s resume to the job description and identify skill gaps. Output ONLY valid JSON in this format: { "missingSkills": ["Skill 1", "Skill 2"], "actionPlan": ["Take course X", "Build project Y"], "shortTermFixes": ["Add keyword Z to resume"] }'
        },
        {
          role: 'user',
          content: `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'reasoning' },
      temperature: 0.4
    });

    let gapData;
    try {
      gapData = safeParseLLMJson(analysis.content);
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse JSON' }, { status: 500 });
    }

    return NextResponse.json({ success: true, analysis: gapData });

  } catch (error) {
    console.error('Skill gap analysis failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
