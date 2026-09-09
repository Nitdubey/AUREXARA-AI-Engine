/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║  AUREXARA AI Engine — Standalone HTTP API Server     ║
 * ║  Deployed at: https://api.aurexara.ai                ║
 * ║                                                       ║
 * ║  Arsenal Plan: 8 Specialist Models via Bedrock Mantle║
 * ║  18 Tool Endpoints for JobMatchAI                    ║
 * ╚═══════════════════════════════════════════════════════╝
 */

import express from 'express';
import cors from 'cors';
import { AurexaraClient } from '@aurexara/engine';

const app = express();
const PORT = process.env['PORT'] || 8080;

// ── CORS: Allow jobmatchai.in and localhost ──
const ALLOWED_ORIGINS = [
  'https://jobmatchai.in',
  'https://www.jobmatchai.in',
  'http://localhost:3000',
  'http://localhost:3001',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow server-to-server calls (no origin header)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

// ── Initialize Arsenal Engine ──
console.log('[Engine] 🚀 Initializing AUREXARA Engine...');
const engine = AurexaraClient.fromEnv('jobmatchai');
console.log('[Engine] ✅ Arsenal Provider ready with 8 specialist models');

// ── API Key Middleware ──
function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const configuredKey = process.env['AUREXARA_API_KEY'];
  // If no key configured, allow all (dev mode)
  if (!configuredKey) return next();

  const providedKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
  if (providedKey !== configuredKey) {
    res.status(401).json({ error: 'Unauthorized: Invalid API key' });
    return;
  }
  next();
}

// ── JSON Safe Parser ──
function safeParseLLMJson(raw: string): unknown {
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch?.[1]) cleaned = fenceMatch[1].trim();
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const start = cleaned.search(/[\[{]/);
    if (start !== -1) cleaned = cleaned.slice(start);
  }
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    const closing = cleaned.startsWith('{') ? '}' : ']';
    const last = cleaned.lastIndexOf(closing);
    if (last !== -1) cleaned = cleaned.slice(0, last + 1);
  }
  return JSON.parse(cleaned);
}

// ── Health Check ──
app.get('/', (_req, res) => {
  res.json({
    service: 'AUREXARA AI Engine',
    version: '2.0.0',
    plan: 'The Arsenal (8 Specialist Models)',
    status: 'operational',
    models: [
      'qwen.qwen3-235b-a22b-2507 (Extractor)',
      'nvidia.nemotron-super-3-120b (ATS)',
      'mistral.mistral-large-3-675b-instruct (Writer)',
      'deepseek.v3.2 (Strategist)',
      'openai.gpt-oss-120b (Conversationalist)',
      'qwen.qwen3-coder-480b-a35b-instruct (Coder)',
      'nvidia.nemotron-nano-3-30b (Sprinter)',
      'qwen.qwen3-next-80b-a3b-instruct (Lightweight)',
    ],
    endpoints: 18,
    docs: 'https://api.aurexara.ai/v1/health',
  });
});

app.get('/v1/health', authMiddleware, async (_req, res) => {
  const health = await engine.models.providers.getEnabled();
  res.json({ status: 'healthy', providers: health.length });
});

// ═══════════════════════════════════════════════════════
// RESUME TOOLS
// ═══════════════════════════════════════════════════════

// 1. Resume Parser → Qwen3 235B (Extraction)
app.post('/v1/tools/resume/parse', authMiddleware, async (req, res) => {
  try {
    const { resumeText } = req.body as { resumeText: string };
    if (!resumeText) { res.status(400).json({ error: 'resumeText is required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are an expert ATS resume parser. Extract the candidate name, email, phone, summary, skills (array), experience (array of {company, role, duration, highlights}), and education (array). ALWAYS respond in valid JSON only.' },
        { role: 'user', content: resumeText }
      ],
      model: 'auto', routingHints: { taskType: 'extraction' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, data: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 2. ATS Checker → Nemotron Super 120B (Precision Matching)
app.post('/v1/tools/jobs/ats', authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body as { resumeText: string; jobDescription: string };
    if (!resumeText || !jobDescription) { res.status(400).json({ error: 'resumeText and jobDescription are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are an ATS (Applicant Tracking System) analyzer. Compare the resume to the job description. Return JSON with: atsScore (0-100), matchedKeywords (array), missingKeywords (array), recommendations (array of strings), passesATS (boolean).' },
        { role: 'user', content: `RESUME:\n${resumeText}\n\nJOB DESCRIPTION:\n${jobDescription}` }
      ],
      model: 'auto', routingHints: { taskType: 'classification' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, atsResult: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 3. Resume Rewrite → Mistral Large 675B (Writing)
app.post('/v1/tools/resume/rewrite', authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription, focusArea } = req.body as { resumeText: string; jobDescription: string; focusArea?: string };
    if (!resumeText || !jobDescription) { res.status(400).json({ error: 'resumeText and jobDescription are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: `You are an elite resume writer. Rewrite the resume to be highly tailored for the job. Focus area: ${focusArea || 'overall impact'}. Use strong action verbs, quantify achievements. Return JSON with: summary (string), experience (array of rewritten bullets), skills (array), improvements (array of changes made).` },
        { role: 'user', content: `RESUME:\n${resumeText}\n\nJOB:\n${jobDescription}` }
      ],
      model: 'auto', routingHints: { taskType: 'writing' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, rewrittenResume: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 4. Cover Letter → Mistral Large 675B (Writing)
app.post('/v1/tools/resume/cover-letter', authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription, companyName, hiringManagerName } = req.body as { resumeText: string; jobDescription: string; companyName?: string; hiringManagerName?: string };
    if (!resumeText || !jobDescription) { res.status(400).json({ error: 'resumeText and jobDescription are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are a professional cover letter writer. Write a compelling, personalized cover letter. Keep it under 400 words. Make it feel human and authentic, not generic.' },
        { role: 'user', content: `Company: ${companyName || 'the company'}\nHiring Manager: ${hiringManagerName || 'Hiring Manager'}\nJob: ${jobDescription}\nMy Resume: ${resumeText}` }
      ],
      model: 'auto', routingHints: { taskType: 'writing' }
    });

    res.json({ success: true, coverLetter: result.content, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 5. Resume Tips → Nemotron Nano 30B (Sprinter)
app.post('/v1/tools/resume/guides', authMiddleware, async (req, res) => {
  try {
    const { industry, level } = req.body as { industry: string; level?: string };
    if (!industry) { res.status(400).json({ error: 'industry is required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are a resume expert. Give 5-7 specific, actionable resume tips.' },
        { role: 'user', content: `Industry: ${industry}, Level: ${level || 'Mid-level'}. Give practical tips.` }
      ],
      model: 'auto', routingHints: { taskType: 'sprinter' }
    });

    res.json({ success: true, guide: result.content, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 6. Bullet Point Enhance → Nemotron Nano 30B (Sprinter)
app.post('/v1/tools/resume/enhance-bullet', authMiddleware, async (req, res) => {
  try {
    const { bulletPoint, roleContext } = req.body as { bulletPoint: string; roleContext?: string };
    if (!bulletPoint) { res.status(400).json({ error: 'bulletPoint is required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'Rewrite the resume bullet using the XYZ formula (Accomplished X as measured by Y by doing Z). Start with a strong action verb. Output ONLY the rewritten bullet, nothing else.' },
        { role: 'user', content: `Bullet: ${bulletPoint}\nContext: ${roleContext || 'Professional role'}` }
      ],
      model: 'auto', routingHints: { taskType: 'sprinter' }, temperature: 0.7
    });

    res.json({ success: true, enhanced: result.content.trim(), model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ═══════════════════════════════════════════════════════
// JOBS TOOLS
// ═══════════════════════════════════════════════════════

// 7. Skill Gap Analysis → DeepSeek V3.2 (Reasoning)
app.post('/v1/tools/jobs/skill-gap', authMiddleware, async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body as { resumeText: string; jobDescription: string };
    if (!resumeText || !jobDescription) { res.status(400).json({ error: 'resumeText and jobDescription are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are a career skills analyst. Analyze the gap between current skills and job requirements. Return JSON with: currentSkills (array), requiredSkills (array), gapSkills (array of missing skills), learningPath (array of {skill, resources, timeToLearn}), overallReadiness (0-100).' },
        { role: 'user', content: `MY SKILLS FROM RESUME:\n${resumeText}\n\nJOB REQUIREMENTS:\n${jobDescription}` }
      ],
      model: 'auto', routingHints: { taskType: 'reasoning' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, analysis: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 8. Should I Apply → DeepSeek V3.2 (Reasoning)
app.post('/v1/tools/jobs/analyze', authMiddleware, async (req, res) => {
  try {
    const { profile, jobDescription } = req.body as { profile: string; jobDescription: string };
    if (!profile || !jobDescription) { res.status(400).json({ error: 'profile and jobDescription are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are a career advisor. Analyze if the candidate should apply to this job. Return JSON with: recommendation ("apply"/"dont_apply"/"apply_with_preparation"), fitScore (0-100), pros (array), cons (array), advice (string), preparationSteps (array).' },
        { role: 'user', content: `MY PROFILE:\n${typeof profile === 'string' ? profile : JSON.stringify(profile)}\n\nJOB:\n${jobDescription}` }
      ],
      model: 'auto', routingHints: { taskType: 'reasoning' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, result: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 9. Follow-up Email → Nemotron Nano 30B (Sprinter)
app.post('/v1/tools/jobs/tracker-followup', authMiddleware, async (req, res) => {
  try {
    const { company, role, daysSinceApplied, customNote } = req.body as { company: string; role: string; daysSinceApplied?: number; customNote?: string };
    if (!company || !role) { res.status(400).json({ error: 'company and role are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'Write a professional, concise follow-up email for a job application. Keep it under 150 words. Friendly, not pushy.' },
        { role: 'user', content: `Company: ${company}, Role: ${role}, Days since applied: ${daysSinceApplied || 7}, Note: ${customNote || 'none'}` }
      ],
      model: 'auto', routingHints: { taskType: 'sprinter' }
    });

    res.json({ success: true, email: result.content, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ═══════════════════════════════════════════════════════
// INTERVIEW TOOLS
// ═══════════════════════════════════════════════════════

// 10. Mock Interview → GPT-OSS 120B (Conversation)
app.post('/v1/tools/interview/mock', authMiddleware, async (req, res) => {
  try {
    const { history, resumeText, jobDescription } = req.body as { history: Array<{ role: string; content: string }>; resumeText?: string; jobDescription?: string };
    if (!history || !Array.isArray(history)) { res.status(400).json({ error: 'history array is required' }); return; }

    const systemPrompt = {
      role: 'system' as const,
      content: `You are a tough but fair Technical/HR Interviewer. Candidate Resume: ${resumeText || 'Not provided'}. Job: ${jobDescription || 'General role'}. Ask one question at a time. Evaluate answers. Stay in character.`
    };

    const messages = [systemPrompt, ...history.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: String(m.content)
    }))];

    const result = await engine.models.complete({
      messages, model: 'auto', routingHints: { taskType: 'conversation' }, temperature: 0.7
    });

    res.json({ success: true, reply: result.content, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 11. Interview Prep Strategy → Mistral Large 675B (Writing)
app.post('/v1/tools/interview/prep', authMiddleware, async (req, res) => {
  try {
    const { company, role, jobDescription } = req.body as { company: string; role: string; jobDescription?: string };
    if (!company || !role) { res.status(400).json({ error: 'company and role are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are an interview preparation coach. Create a comprehensive interview prep strategy. Return JSON with: companyResearch (array of tips), likelyQuestions (array of {question, type, tipToAnswer}), technicalTopics (array), behavioralFramework (string), dayOfTips (array).' },
        { role: 'user', content: `Company: ${company}, Role: ${role}, JD: ${jobDescription || 'Not provided'}` }
      ],
      model: 'auto', routingHints: { taskType: 'writing' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, prepData: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ═══════════════════════════════════════════════════════
// CAREER TOOLS
// ═══════════════════════════════════════════════════════

// 12. Career Profile Extraction → Qwen3 235B (Extraction)
app.post('/v1/tools/career/profile', authMiddleware, async (req, res) => {
  try {
    const { resumeText } = req.body as { resumeText: string };
    if (!resumeText) { res.status(400).json({ error: 'resumeText is required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'Extract a structured career profile. Return JSON with: name, currentRole, yearsOfExperience (number), topSkills (array), industries (array), careerLevel ("junior"/"mid"/"senior"/"staff"/"executive"), strengths (array), targetRoles (array of suggestions).' },
        { role: 'user', content: resumeText }
      ],
      model: 'auto', routingHints: { taskType: 'extraction' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, profile: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 13. Salary Negotiation Coach → GPT-OSS 120B (Conversation)
app.post('/v1/tools/career/salary', authMiddleware, async (req, res) => {
  try {
    const { history, targetRole, targetSalary } = req.body as { history: Array<{ role: string; content: string }>; targetRole?: string; targetSalary?: string };
    if (!history || !Array.isArray(history)) { res.status(400).json({ error: 'history array is required' }); return; }

    const systemPrompt = {
      role: 'system' as const,
      content: `You are a tough HR Manager negotiating salary. Role: ${targetRole || 'Not specified'}. Candidate target: ${targetSalary || 'Not specified'}. Push back professionally. Stay in character.`
    };

    const messages = [systemPrompt, ...history.map(m => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: String(m.content)
    }))];

    const result = await engine.models.complete({
      messages, model: 'auto', routingHints: { taskType: 'conversation' }, temperature: 0.7
    });

    res.json({ success: true, reply: result.content, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 14. Career Copilot Roadmap → DeepSeek V3.2 (Reasoning)
app.post('/v1/tools/career/copilot', authMiddleware, async (req, res) => {
  try {
    const { profile, goal } = req.body as { profile: string; goal: string };
    if (!profile || !goal) { res.status(400).json({ error: 'profile and goal are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are a career strategist. Create a focused 12-month career roadmap. Return JSON with: currentState (string), targetState (string), milestones (array of {month, goal, actions (array)}), keySkillsToLearn (array of {skill, priority, resources}), networkingStrategy (string), timeline (string).' },
        { role: 'user', content: `Profile: ${typeof profile === 'string' ? profile : JSON.stringify(profile)}\nGoal: ${goal}` }
      ],
      model: 'auto', routingHints: { taskType: 'reasoning' }, maxTokens: 2048
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, plan: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 15. LinkedIn Audit → Mistral Large 675B (Writing)
app.post('/v1/tools/career/linkedin-audit', authMiddleware, async (req, res) => {
  try {
    const { linkedinProfileText } = req.body as { linkedinProfileText: string };
    if (!linkedinProfileText) { res.status(400).json({ error: 'linkedinProfileText is required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are a LinkedIn optimization expert. Audit the profile. Return JSON with: overallScore (0-100), headlineScore (0-100), headlineSuggestion (string), aboutScore (0-100), aboutSuggestion (string), experienceImprovements (array), keywordsToAdd (array), recommendations (array of actionable tips).' },
        { role: 'user', content: linkedinProfileText }
      ],
      model: 'auto', routingHints: { taskType: 'writing' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, audit: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 16. Rejection Analysis → GPT-OSS 120B (Conversation/Empathy)
app.post('/v1/tools/career/rejection-analysis', authMiddleware, async (req, res) => {
  try {
    const { company, role, rejectionEmailText, profile } = req.body as { company: string; role: string; rejectionEmailText: string; profile?: string };
    if (!company || !role || !rejectionEmailText) { res.status(400).json({ error: 'company, role, and rejectionEmailText are required' }); return; }

    const result = await engine.models.complete({
      messages: [
        { role: 'system', content: 'You are an empathetic career coach. Analyze the rejection and provide constructive guidance. Return JSON with: likelyReason (string), positiveFraming (string), areasToImprove (array of {area, advice}), nextSteps (array), encouragement (string), reapplyStrategy (string).' },
        { role: 'user', content: `Company: ${company}, Role: ${role}\nRejection Email: ${rejectionEmailText}\nMy Profile: ${typeof profile === 'string' ? profile : JSON.stringify(profile || {})}` }
      ],
      model: 'auto', routingHints: { taskType: 'conversation' }
    });

    let parsed: Record<string, unknown> = {};
    try { parsed = safeParseLLMJson(result.content) as Record<string, unknown>; }
    catch { parsed = { raw: result.content }; }

    res.json({ success: true, analysis: parsed, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ═══════════════════════════════════════════════════════
// CHAT TOOL
// ═══════════════════════════════════════════════════════

// 17. Core Chat → Mistral Large 675B (Writing / General)
app.post('/v1/tools/chat', authMiddleware, async (req, res) => {
  try {
    const { messages } = req.body as { messages: Array<{ role: string; content: string }> };
    if (!messages || !Array.isArray(messages)) { res.status(400).json({ error: 'messages array is required' }); return; }

    const systemMsg = { role: 'system' as const, content: 'You are a helpful AI career assistant for JobMatchAI. Help users with career advice, resume tips, interview preparation, and job search strategies.' };
    const chatMessages = [systemMsg, ...messages.map(m => ({
      role: (m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'system') as 'user' | 'assistant' | 'system',
      content: String(m.content)
    }))];

    const result = await engine.models.complete({
      messages: chatMessages, model: 'auto', routingHints: { taskType: 'writing' }, temperature: 0.7
    });

    res.json({ success: true, response: result.content, model: result.model, cost: result.cost });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// 18. Cost Stats (for monitoring)
app.get('/v1/stats', authMiddleware, (_req, res) => {
  const costs = engine.costs.getSummary();
  res.json({ success: true, costs });
});

// ── Start Server ──
app.listen(PORT, () => {
  console.log(`\n╔═══════════════════════════════════════════╗`);
  console.log(`║  AUREXARA Engine running on port ${PORT}    ║`);
  console.log(`║  Arsenal Plan: 8 Models, 17 Tool Endpoints║`);
  console.log(`╚═══════════════════════════════════════════╝\n`);
});

export default app;
