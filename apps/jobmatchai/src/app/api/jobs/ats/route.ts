import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  // Security Layer
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { resumeText, jobDescription } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Resume and Job Description are required' }, { status: 400 });
    }

    // Engine Route: 'fast' hint will automatically select Claude 3.5 Haiku (Balanced Tier)
    const analysis = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert ATS (Applicant Tracking System) software. Analyze the provided resume against the job description. Output ONLY valid JSON in this format: { "score": 85, "missingKeywords": ["React", "AWS"], "matchingKeywords": ["Node.js", "TypeScript"], "suggestions": ["Add more metrics to experience"] }'
        },
        {
          role: 'user',
          content: `Resume:\n${resumeText}\n\nJob Description:\n${jobDescription}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'fast' }, // Haiku selected automatically
      temperature: 0.2 // Low temperature for factual analysis
    });

    let atsData;
    try {
      atsData = safeParseLLMJson(analysis.content);
    } catch (e) {
      console.error("Failed to parse ATS JSON", analysis.content);
      return NextResponse.json({ error: 'Failed to generate valid ATS report' }, { status: 500 });
    }

    return NextResponse.json({ success: true, atsResult: atsData });

  } catch (error) {
    console.error('ATS check failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
