import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { industry, level } = await req.json();

    if (!industry) {
      return NextResponse.json({ error: 'Industry is required' }, { status: 400 });
    }

    // Generation task: 'fast' hint selects Haiku for general knowledge
    const guide = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer. Provide 5 highly specific, actionable resume tips for the requested industry and experience level. Output as a markdown list.'
        },
        {
          role: 'user',
          content: `Industry: ${industry}\nExperience Level: ${level || 'Mid-level'}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'sprinter' },
      temperature: 0.5
    });

    return NextResponse.json({ success: true, guide: guide.content });

  } catch (error) {
    console.error('Resume guide generation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
