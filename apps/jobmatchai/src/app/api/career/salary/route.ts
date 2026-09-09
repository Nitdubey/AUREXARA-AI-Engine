import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';


export async function POST(req: Request) {
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { history, targetRole, targetSalary } = await req.json();

    if (!history || !Array.isArray(history)) {
      return NextResponse.json({ error: 'Conversation history is required' }, { status: 400 });
    }

    const systemPrompt = {
      role: 'system' as const,
      content: `You are a tough HR Manager negotiating salary with a candidate. 
      Target Role: ${targetRole || 'Not specified'}
      Candidate's Target Salary: ${targetSalary || 'Not specified'}
      
      Instructions:
      1. Push back on their initial salary expectations professionally.
      2. Ask them to justify why they deserve this amount.
      3. Maintain a professional but firm HR persona.
      4. Keep responses concise and realistic for a negotiation scenario.`
    };

    const messages = [systemPrompt, ...history.map((msg: any) => ({
      role: (msg.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: String(msg.content)
    }))];

    // Roleplay/Reasoning task: 'reasoning' hint selects Sonnet
    const response = await engine.models.complete({
      messages,
      model: 'auto',
      routingHints: { taskType: 'reasoning' },
      temperature: 0.7
    });

    return NextResponse.json({ success: true, reply: response.content });

  } catch (error) {
    console.error('Salary negotiation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
