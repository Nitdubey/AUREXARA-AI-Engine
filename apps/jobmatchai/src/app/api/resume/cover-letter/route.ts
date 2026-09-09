import { NextResponse } from 'next/server';
import { engine } from '@/lib/ai/provider';
import { checkSecurity } from '@/lib/security/middleware';

export async function POST(req: Request) {
  // Security Layer
  const blocked = checkSecurity(req);
  if (blocked) return blocked;

  try {
    const { resumeText, jobDescription, companyName, hiringManagerName } = await req.json();

    if (!resumeText || !jobDescription) {
      return NextResponse.json({ error: 'Resume and Job Description are required' }, { status: 400 });
    }

    // Engine Route: 'reasoning' hint -> Claude 3.5 Sonnet
    const coverLetter = await engine.models.complete({
      messages: [
        {
          role: 'system',
          content: 'You are an expert career coach. Write a compelling, professional, and highly personalized cover letter. Do NOT use generic templates. Draw connections between the candidate\'s resume and the specific requirements in the job description. Maintain a confident and enthusiastic tone. Output the final cover letter as plain text.'
        },
        {
          role: 'user',
          content: `Candidate Resume:\n${resumeText}\n\nTarget Job Description:\n${jobDescription}\n\n` + 
                   (companyName ? `Company: ${companyName}\n` : '') +
                   (hiringManagerName ? `Hiring Manager: ${hiringManagerName}` : '')
        }
      ],
      model: 'auto',
      routingHints: { taskType: 'writing' },
      temperature: 0.7 
    });

    return NextResponse.json({ 
      success: true, 
      coverLetter: coverLetter.content 
    });

  } catch (error) {
    console.error('Cover letter generation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
