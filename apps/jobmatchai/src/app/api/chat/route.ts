import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity, corsHeaders } from '@/lib/security/middleware';
import type { SearchResult } from '@aurexara/knowledge-core';

export async function POST(req: Request) {
  // Security: API Key + Rate Limit + CORS check
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { messages } = await req.json();

    if (!messages || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1].content;

    // 1. Semantic search for context
    const searchResults = await engine.knowledge.search(lastMessage, 5) as SearchResult[];
    
    let contextStr = '';
    if (searchResults && searchResults.length > 0) {
      contextStr = 'Here are some resumes from the knowledge base that might be relevant:\n\n' + 
        searchResults.map((res, i) => `--- Resume ${i+1} ---\n${res.content}`).join('\n\n');
    }

    // 2. Build the messages for the LLM
    const systemPrompt = `You are JobMatchAI's internal recruiter assistant. Answer the user's queries based on the candidate resumes provided in the context. Be helpful, concise, and professional.\n\n${contextStr}`;

    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...messages
    ];

    // 3. Get response
    const result = await engine.models.complete({
      messages: llmMessages,
      model: 'auto',
      routingHints: { taskType: 'generation' }
    });

    return NextResponse.json({ response: result.content });
  } catch (error) {
    console.error('Chat failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
