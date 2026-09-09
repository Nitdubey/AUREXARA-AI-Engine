import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { company, role, daysSinceApplied, customNote } = await req.json();

    // Fast task: Haiku writes a quick email
    const followup = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach. Write a short, professional, and polite follow-up email to a recruiter for a job application. Output ONLY the email text (Subject line included).'
        },
        {
          role: 'user',
          content: `Company: ${company}\nRole: ${role}\nDays since applied: ${daysSinceApplied}\nExtra note: ${customNote || 'None'}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'sprinter' },
      temperature: 0.6 
    });

    return NextResponse.json({ success: true, email: followup.content });
  } catch (error) {
    console.error('Follow-up generation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
