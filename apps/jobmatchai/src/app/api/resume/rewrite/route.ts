import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  // Security Layer
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { resumeText, jobDescription, focusArea } = await req.json();

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // Engine Route: 'reasoning' hint will automatically select Claude 3.5 Sonnet (Balanced Tier)
    const rewrite = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an elite executive resume writer. Your task is to rewrite the provided resume to make it highly impactful, action-oriented, and quantified. ' + 
                   (jobDescription ? 'Tailor the resume specifically to the provided Job Description.' : '') +
                   'Output ONLY valid JSON in this format: { "summary": "New impactful summary", "experience": [ { "role": "Role", "company": "Company", "bullets": ["Improved X by Y%"] } ], "skills": ["Skill 1", "Skill 2"] }'
        },
        {
          role: 'user',
          content: `Resume to rewrite:\n${resumeText}\n\n` + 
                   (jobDescription ? `Target Job Description:\n${jobDescription}\n\n` : '') +
                   (focusArea ? `Focus Areas to emphasize:\n${focusArea}` : '')
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'writing' }, // Sonnet selected automatically for high quality
      temperature: 0.7 
    });

    let rewriteData;
    try {
      rewriteData = safeParseLLMJson(rewrite.content);
    } catch (e) {
      console.error("Failed to parse Rewrite JSON", rewrite.content);
      return NextResponse.json({ error: 'Failed to generate valid rewrite' }, { status: 500 });
    }

    return NextResponse.json({ success: true, rewrittenResume: rewriteData });

  } catch (error) {
    console.error('Resume rewrite failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
