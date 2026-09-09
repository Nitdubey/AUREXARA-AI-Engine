import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { resumeText } = await req.json();

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // Extraction task: 'fast' hint selects Haiku
    const profile = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction bot. Extract the following from the resume and output ONLY valid JSON: { "name": "", "email": "", "phone": "", "totalYearsExperience": 0, "topSkills": [], "recentJobTitle": "", "education": [] }'
        },
        {
          role: 'user',
          content: resumeText
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'extraction' },
      temperature: 0.1
    });

    let profileData;
    try {
      profileData = safeParseLLMJson(profile.content);
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse profile JSON' }, { status: 500 });
    }

    return NextResponse.json({ success: true, profile: profileData });

  } catch (error) {
    console.error('Profile extraction failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
