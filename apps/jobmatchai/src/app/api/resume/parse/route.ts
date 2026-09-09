import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity, corsHeaders } from '@/lib/security/middleware';
import { safeParseLLMJson } from '@/lib/ai/parse-json';

export async function POST(req: Request) {
  // Security: API Key + Rate Limit + CORS check
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { resumeText } = await req.json();

    if (!resumeText) {
      return NextResponse.json({ error: 'Resume text is required' }, { status: 400 });
    }

    // 1. Ingest the resume into the Knowledge Base for future job matching
    await engine.knowledge.ingestMarkdown(resumeText);

    // 2. Extract structured candidate information
    const result = await engine.models.complete({
      messages: [
        { 
          role: 'system', 
          content: 'You are an expert ATS resume parser. Extract the candidate name, email, phone, and skills from the resume. ALWAYS respond in valid JSON format with the keys: "name", "email", "phone", "skills" (array of strings).' 
        },
        { 
          role: 'user', 
          content: resumeText 
        }
      ],
      model: 'auto',
      routingHints: {
        taskType: 'extraction'
      }
    });

    let parsedData: Record<string, unknown> = {};
    try {
      parsedData = safeParseLLMJson(result.content) as Record<string, unknown>;
    } catch (e) {
      console.warn("Could not parse JSON from LLM", result.content);
      parsedData = { raw: result.content };
    }

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error) {
    console.error('Resume parsing failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
