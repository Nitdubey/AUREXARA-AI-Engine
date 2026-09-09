/**
 * ╔══════════════════════════════════════════════════╗
 * ║  AUREXARA ARSENAL ENGINE — DEEP STRESS TEST     ║
 * ║  Tests all 18 JobMatchAI tools with realistic   ║
 * ║  payloads and scores each on Speed, Success,    ║
 * ║  and Content Quality.                           ║
 * ╚══════════════════════════════════════════════════╝
 */
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const TIMEOUT_MS = 30000; // 30 seconds per request

// ── Arsenal Model Assignments ──
const MODEL_MAP = {
  extraction:    'qwen.qwen3-235b-a22b-2507',
  fast:          'nvidia.nemotron-super-3-120b',
  writing:       'mistral.mistral-large-3-675b-instruct',
  reasoning:     'deepseek.v3.2',
  conversation:  'openai.gpt-oss-120b',
  coding:        'qwen.qwen3-coder-480b-a35b-instruct',
  sprinter:      'nvidia.nemotron-nano-3-30b',
};

// ── Test Definitions: path, payload, expected response keys, task type ──
const TESTS = [
  {
    name: 'Resume Parser',
    path: '/api/resume/parse',
    taskType: 'extraction',
    payload: { resumeText: 'John Doe\nPhone: +91-9876543210\nEmail: john.doe@gmail.com\nSkills: React, TypeScript, Node.js, Python, AWS, Docker\nExperience:\n- Senior Frontend Engineer at Google (2020-2024)\n- Full Stack Developer at Microsoft (2017-2020)\nEducation: B.Tech Computer Science, IIT Delhi (2017)' },
    responseKey: 'data',
    expectJSON: true,
  },
  {
    name: 'ATS Checker',
    path: '/api/jobs/ats',
    taskType: 'fast',
    payload: { resumeText: 'Skills: React, TypeScript, Node.js, PostgreSQL, Docker\nExperience: 5 years building scalable web apps\nLed migration from class components to hooks, reducing bundle size by 40%', jobDescription: 'Requirements: React, TypeScript, Node.js, AWS, Docker, CI/CD, GraphQL\nNice to have: Python, Kubernetes\nRole: Senior Frontend Engineer' },
    responseKey: 'atsResult',
    expectJSON: true,
  },
  {
    name: 'Resume Rewrite',
    path: '/api/resume/rewrite',
    taskType: 'writing',
    payload: { resumeText: 'Made website faster. Led team of 3. Built dashboard for analytics. Fixed bugs in production.', jobDescription: 'Looking for a technical leader who can drive performance optimization and team growth', focusArea: 'Leadership & Impact' },
    responseKey: 'rewrittenResume',
    expectJSON: true,
  },
  {
    name: 'Cover Letter Generator',
    path: '/api/resume/cover-letter',
    taskType: 'writing',
    payload: { resumeText: 'React Developer with 5 years exp at Google and Microsoft. Strong TypeScript, Node.js.', jobDescription: 'Senior Frontend Engineer at Vercel', companyName: 'Vercel', hiringManagerName: 'Guillermo Rauch' },
    responseKey: 'coverLetter',
    expectJSON: false,
  },
  {
    name: 'Mock Interview',
    path: '/api/interview/mock',
    taskType: 'conversation',
    payload: { history: [{role: 'user', content: 'I am ready to start the mock interview. My strongest area is React and system design.'}], resumeText: 'React Developer with 5 years experience at Google. Built high-traffic dashboards serving 10M users.', jobDescription: 'Senior Frontend Engineer - must have strong React, TypeScript, and system design skills' },
    responseKey: 'reply',
    expectJSON: false,
  },
  {
    name: 'Career Profile Extraction',
    path: '/api/career/profile',
    taskType: 'extraction',
    payload: { resumeText: 'Jane Doe\nExperience: Google (2020-2023) Software Engineer, Meta (2023-present) Senior SWE\nSkills: React, Node, Python, AWS, Kubernetes, GraphQL\nEducation: MS CS Stanford (2020)\nCertifications: AWS Solutions Architect' },
    responseKey: 'profile',
    expectJSON: true,
  },
  {
    name: 'Salary Negotiation Coach',
    path: '/api/career/salary',
    taskType: 'reasoning',
    payload: { history: [{role: 'user', content: 'I was hoping for a base salary of $180,000 for the Senior SDE role.'}], targetRole: 'Senior Software Development Engineer', targetSalary: '$180,000' },
    responseKey: 'reply',
    expectJSON: false,
  },
  {
    name: 'Skill Gap Analysis',
    path: '/api/jobs/skill-gap',
    taskType: 'reasoning',
    payload: { resumeText: 'Skills: React, Node.js, SQL, HTML, CSS, Git\nExperience: 3 years frontend development', jobDescription: 'Requirements: React, Node.js, Python, AWS, Docker, Kubernetes, CI/CD, GraphQL, System Design\nRole: Senior Full Stack Engineer' },
    responseKey: 'analysis',
    expectJSON: true,
  },
  {
    name: 'Resume Tips',
    path: '/api/resume/guides',
    taskType: 'sprinter',
    payload: { industry: 'Software Engineering', level: 'Senior' },
    responseKey: 'guide',
    expectJSON: false,
  },
  {
    name: 'Should I Apply',
    path: '/api/jobs/analyze',
    taskType: 'reasoning',
    payload: { profile: 'Mid-level React Developer with 3 years experience. Strong in frontend, weak in backend and system design. No AWS experience.', jobDescription: 'Senior Full Stack Engineer - 5+ years required. Must have AWS, Docker, System Design experience. Strong backend skills required.' },
    responseKey: 'result',
    expectJSON: true,
  },
  {
    name: 'Career Copilot Roadmap',
    path: '/api/career/copilot',
    taskType: 'reasoning',
    payload: { profile: 'Mid-level React Developer, 4 years experience at startups, strong frontend skills, learning backend', goal: 'Become a Staff Engineer at a FAANG company within 3 years' },
    responseKey: 'plan',
    expectJSON: true,
  },
  {
    name: 'Interview Prep Strategy',
    path: '/api/interview/prep',
    taskType: 'writing',
    payload: { company: 'Google', role: 'Senior Frontend Engineer', jobDescription: 'Looking for a strong React developer with Next.js experience, system design skills, and ability to mentor junior engineers.' },
    responseKey: 'prepData',
    expectJSON: true,
  },
  {
    name: 'LinkedIn Audit',
    path: '/api/career/linkedin-audit',
    taskType: 'writing',
    payload: { linkedinProfileText: 'Headline: Web Developer | React & Node\nAbout: Passionate developer who loves coding. I build websites and apps.\nExperience: 5 years as a web developer at various companies.\nSkills: HTML, CSS, JavaScript, React\nConnections: 200\nNo recommendations or certifications listed.' },
    responseKey: 'audit',
    expectJSON: true,
  },
  {
    name: 'Rejection Analysis',
    path: '/api/career/rejection-analysis',
    taskType: 'conversation',
    payload: { company: 'Amazon', role: 'SDE II', rejectionEmailText: 'Thank you for your interest in the SDE II position at Amazon. After careful consideration, we have decided to move forward with candidates whose experience more closely aligns with our current needs, particularly in distributed systems and system design. We encourage you to reapply in 6 months.', profile: 'SDE with 3 years experience, strong in algorithms and data structures, limited system design experience, no distributed systems background' },
    responseKey: 'analysis',
    expectJSON: true,
  },
  {
    name: 'Bullet Point Enhance',
    path: '/api/resume/enhance-bullet',
    taskType: 'sprinter',
    payload: { bulletPoint: 'Made the website faster by fixing code and optimizing images', roleContext: 'Senior Frontend Engineer at a fintech startup' },
    responseKey: 'enhanced',
    expectJSON: false,
  },
  {
    name: 'Tracker Follow-up Email',
    path: '/api/jobs/tracker-followup',
    taskType: 'sprinter',
    payload: { company: 'Netflix', role: 'UI Engineer', daysSinceApplied: 14, customNote: 'Met the recruiter at ReactConf last month and had a great conversation about the role' },
    responseKey: 'email',
    expectJSON: false,
  },
  {
    name: 'Job Match (RAG)',
    path: '/api/jobs/match',
    taskType: 'reasoning',
    payload: { jobDescription: 'React Developer with TypeScript and Node.js experience' },
    responseKey: 'matches',
    expectJSON: false,
  },
  {
    name: 'Core Chat',
    path: '/api/chat',
    taskType: 'writing',
    payload: { messages: [{role: 'user', content: 'What is the STAR method for answering behavioral interview questions? Give me a brief explanation with an example.'}] },
    responseKey: 'response',
    expectJSON: false,
  },
];

// ── Scoring Functions ──
function scoreSpeed(ms) {
  if (ms <= 2000) return 30;   // Lightning
  if (ms <= 4000) return 25;   // Fast
  if (ms <= 8000) return 20;   // Good
  if (ms <= 15000) return 10;  // Slow
  if (ms <= 25000) return 5;   // Very slow
  return 0;                     // Timeout
}

function scoreContent(responseData, test) {
  let score = 0;
  const value = responseData[test.responseKey];
  
  if (value === undefined || value === null) return 0;
  
  // Has the expected key
  score += 10;
  
  const content = typeof value === 'string' ? value : JSON.stringify(value);
  const len = content.length;
  
  // Content length scoring
  if (test.expectJSON) {
    // JSON responses: check if it's a proper object/array
    if (typeof value === 'object' && value !== null) score += 15;
    else score += 5;
  } else {
    // Text responses: check length quality
    if (len > 200) score += 15;
    else if (len > 50) score += 10;
    else score += 5;
  }
  
  // Bonus for detailed responses
  if (len > 500) score += 5;
  
  return score; // Max 30
}

function getGrade(score) {
  if (score >= 90) return 'S';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function getEmoji(grade) {
  return { S: '🏆', A: '⭐', B: '✅', C: '⚠️', D: '🟡', F: '❌' }[grade] || '❓';
}

// ── Main Test Runner ──
async function runDeepStressTest() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  AUREXARA ARSENAL ENGINE — DEEP STRESS TEST     ║');
  console.log('║  Testing 18 tools with 8 specialist models      ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
  
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (let i = 0; i < TESTS.length; i++) {
    const test = TESTS[i];
    const num = String(i + 1).padStart(2, '0');
    process.stdout.write(`[${num}/${TESTS.length}] ${test.name}... `);
    
    const start = Date.now();
    let status = 'FAIL';
    let ms = 0;
    let speedScore = 0;
    let successScore = 0;
    let contentScore = 0;
    let totalScore = 0;
    let details = '';
    let responseData = null;
    let httpStatus = 0;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      const res = await fetch(`${BASE_URL}${test.path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(test.payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      
      ms = Date.now() - start;
      httpStatus = res.status;
      
      if (res.ok) {
        responseData = await res.json();
        status = 'PASS';
        passed++;
        
        // Success score: 40 points for HTTP 200
        successScore = 40;
        
        // Speed score: up to 30 points
        speedScore = scoreSpeed(ms);
        
        // Content quality score: up to 30 points
        contentScore = scoreContent(responseData, test);
        
        totalScore = successScore + speedScore + contentScore;
        
        const respLen = JSON.stringify(responseData).length;
        details = `${respLen} chars`;
      } else {
        ms = Date.now() - start;
        const errBody = await res.text();
        failed++;
        details = `HTTP ${httpStatus}: ${errBody.substring(0, 100)}`;
      }
    } catch (err) {
      ms = Date.now() - start;
      failed++;
      if (err.name === 'AbortError') {
        details = `TIMEOUT after ${TIMEOUT_MS/1000}s`;
      } else {
        details = `Error: ${err.message.substring(0, 80)}`;
      }
    }
    
    const grade = getGrade(totalScore);
    const emoji = getEmoji(grade);
    
    results.push({
      name: test.name,
      path: test.path,
      model: MODEL_MAP[test.taskType] || 'unknown',
      taskType: test.taskType,
      status,
      ms,
      httpStatus,
      speedScore,
      successScore,
      contentScore,
      totalScore,
      grade,
      emoji,
      details,
    });
    
    console.log(`${emoji} ${status} | Score: ${totalScore}/100 (${grade}) | ${ms}ms | ${details}`);
  }
  
  // ── Calculate Summary Stats ──
  const avgScore = results.reduce((sum, r) => sum + r.totalScore, 0) / results.length;
  const avgLatency = results.filter(r => r.status === 'PASS').reduce((sum, r) => sum + r.ms, 0) / (passed || 1);
  const successRate = (passed / results.length * 100).toFixed(1);
  
  // Model performance
  const modelStats = {};
  for (const r of results) {
    if (!modelStats[r.model]) modelStats[r.model] = { scores: [], passes: 0, fails: 0, latencies: [] };
    modelStats[r.model].scores.push(r.totalScore);
    if (r.status === 'PASS') { modelStats[r.model].passes++; modelStats[r.model].latencies.push(r.ms); }
    else modelStats[r.model].fails++;
  }
  
  // ── Generate Beautiful Report ──
  let md = `# 🏟️ AUREXARA Arsenal Engine — Deep Stress Test Report\n\n`;
  md += `> **Test Date:** ${new Date().toISOString().split('T')[0]}  \n`;
  md += `> **Endpoint:** \`${BASE_URL}\`  \n`;
  md += `> **Total Tools:** ${TESTS.length}  \n`;
  md += `> **Timeout:** ${TIMEOUT_MS/1000}s per request  \n\n`;
  
  md += `## 📊 Overall Results\n\n`;
  md += `| Metric | Value |\n|---|---|\n`;
  md += `| **Overall Score** | **${avgScore.toFixed(1)} / 100** |\n`;
  md += `| **Success Rate** | **${successRate}%** (${passed}/${results.length}) |\n`;
  md += `| **Avg Latency (passing)** | **${avgLatency.toFixed(0)}ms** |\n`;
  md += `| **Grade** | **${getEmoji(getGrade(avgScore))} ${getGrade(avgScore)}** |\n\n`;
  
  md += `## 🎯 Tool-by-Tool Scores\n\n`;
  md += `| # | Tool | Model | Latency | Speed | Success | Content | **Total** | Grade |\n`;
  md += `|---|---|---|---|---|---|---|---|---|\n`;
  
  results.forEach((r, i) => {
    const modelShort = r.model.split('.').pop().substring(0, 20);
    md += `| ${i+1} | ${r.name} | \`${modelShort}\` | ${r.ms}ms | ${r.speedScore}/30 | ${r.successScore}/40 | ${r.contentScore}/30 | **${r.totalScore}/100** | ${r.emoji} ${r.grade} |\n`;
  });
  
  md += `\n## 🤖 Model Performance Summary\n\n`;
  md += `| Model | Tools | Pass Rate | Avg Score | Avg Latency |\n`;
  md += `|---|---|---|---|---|\n`;
  
  for (const [model, stats] of Object.entries(modelStats)) {
    const modelShort = model.split('.').slice(-1)[0].substring(0, 25);
    const avg = stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length;
    const avgLat = stats.latencies.length > 0 ? (stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(0) : 'N/A';
    const total = stats.passes + stats.fails;
    md += `| \`${modelShort}\` | ${total} | ${stats.passes}/${total} (${(stats.passes/total*100).toFixed(0)}%) | ${avg.toFixed(1)} | ${avgLat}ms |\n`;
  }
  
  // Failed tools detail
  const failedTests = results.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    md += `\n## ❌ Failed Tools — Root Cause\n\n`;
    md += `| Tool | Model | Error |\n|---|---|---|\n`;
    failedTests.forEach(r => {
      md += `| ${r.name} | \`${r.model.split('.').pop()}\` | ${r.details} |\n`;
    });
  }
  
  // Scoring explanation
  md += `\n## 📏 Scoring Methodology\n\n`;
  md += `Each tool is scored on **3 dimensions** (total 100 points):\n\n`;
  md += `| Dimension | Max Points | Criteria |\n|---|---|---|\n`;
  md += `| **Success** | 40 | HTTP 200 response |\n`;
  md += `| **Speed** | 30 | ≤2s=30, ≤4s=25, ≤8s=20, ≤15s=10, ≤25s=5 |\n`;
  md += `| **Content** | 30 | Has expected key (10) + Quality (15) + Detail bonus (5) |\n`;
  
  const artifactPath = 'C:/Users/user/.gemini/antigravity/brain/e8858502-f518-496f-bbcf-f2a06067cdb1/stress_test_results.md';
  fs.writeFileSync(artifactPath, md);
  
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Overall Score: ${avgScore.toFixed(1)}/100 (${getGrade(avgScore)})`);
  console.log(`Success Rate: ${successRate}% (${passed}/${results.length})`);
  console.log(`Avg Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`Report saved to: ${artifactPath}`);
  console.log(`${'═'.repeat(50)}`);
}

runDeepStressTest();
