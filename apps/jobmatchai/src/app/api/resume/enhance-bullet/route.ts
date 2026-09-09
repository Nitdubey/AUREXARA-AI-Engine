import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';

export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { bulletPoint, roleContext } = await req.json();

    // Fast task: Haiku enhances a single bullet point quickly
    const enhanced = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an elite resume writer. Rewrite the provided resume bullet point to make it highly impactful, using the XYZ formula (Accomplished X as measured by Y, by doing Z). Start with a strong action verb. Output ONLY the rewritten text, nothing else.'
        },
        {
          role: 'user',
          content: `Bullet: ${bulletPoint}\nContext: ${roleContext || 'General'}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'sprinter' }, // Haiku is perfect for this quick rewrite
      temperature: 0.7 
    });

    return NextResponse.json({ success: true, enhanced: enhanced.content.trim() });
  } catch (error) {
    console.error('Bullet enhance failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
