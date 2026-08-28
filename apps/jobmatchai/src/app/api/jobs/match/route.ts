import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import type { SearchResult } from '@aurexara/knowledge-core';

export async function POST(req: Request) {
  try {
    const { jobDescription } = await req.json();

    if (!jobDescription) {
      return NextResponse.json({ error: 'Job description is required' }, { status: 400 });
    }

    // 1. Search the knowledge base for matching resumes
    const searchResults = await engine.knowledge.search(jobDescription, 3) as SearchResult[];

    if (!searchResults || searchResults.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 2. Format the matches with LLM to explain why they match
    const candidatesStr = searchResults.map((res, i) => `[Candidate ${i + 1}]:\n${res.content}\n`).join('\n');
    
    const analysis = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert tech recruiter. Given a Job Description and a list of Candidate resumes, evaluate each candidate. Output valid JSON in this format: { "matches": [ { "candidateId": "Candidate 1", "fitScore": 85, "reason": "Short reason why they match" } ] }'
        },
        {
          role: 'user',
          content: `Job Description:\n${jobDescription}\n\nCandidates:\n${candidatesStr}`
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'reasoning' }
    });

    let matchData: any = { matches: [] };
    try {
      matchData = JSON.parse(analysis.content);
    } catch (e) {
      console.warn("Could not parse JSON for matches", analysis.content);
    }

    return NextResponse.json({
      success: true,
      matches: matchData.matches,
      rawCandidates: searchResults
    });
  } catch (error) {
    console.error('Job matching failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
