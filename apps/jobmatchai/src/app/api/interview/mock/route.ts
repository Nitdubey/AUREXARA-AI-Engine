import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';


export async function POST(req: Request) {
  // Security Layer
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { history, resumeText, jobDescription } = await req.json();

    if (!history || !Array.isArray(history)) {
      return NextResponse.json({ error: 'Conversation history is required' }, { status: 400 });
    }

    const systemPrompt = {
      role: 'system' as const,
      content: `You are a tough but fair Technical/HR Interviewer conducting a mock interview.
      
      Candidate's Resume:
      ${resumeText || 'Not provided'}
      
      Job Description they applied for:
      ${jobDescription || 'General Software Engineering Role'}
      
      Instructions:
      1. Ask one question at a time.
      2. If the user answers, evaluate their answer briefly and ask a follow-up or move to the next topic.
      3. Tailor your questions strictly to their resume and the job description.
      4. Maintain the persona of a professional interviewer. Do not break character.
      5. Keep responses concise and conversational.`
    };

    const messages = [systemPrompt, ...history.map((msg: any) => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: String(msg.content)
    }))];

    // Engine Route: 'reasoning' hint -> Claude 3.5 Sonnet for deep conversational context
    const response = await engine.models.complete({
      messages,
      model: 'auto',
      routingHints: { taskType: 'conversation' },
      temperature: 0.8 // slightly higher for conversational variety
    });

    return NextResponse.json({ 
      success: true, 
      reply: response.content 
    });

  } catch (error) {
    console.error('Mock interview failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
