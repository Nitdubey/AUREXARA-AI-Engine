import { NextResponse } from 'next/server';

/**
 * AUREXARA API Security Middleware
 * 
 * 3 Layers of Protection:
 * 1. API Key Authentication — only valid keys can access the API
 * 2. Rate Limiting — max requests per IP per minute
 * 3. CORS — only allowed origins can call the API
 */

// ─── Allowed Origins (only YOUR domains) ───
const ALLOWED_ORIGINS = [
  'https://jobmatchai.in',
  'https://www.jobmatchai.in',
  'https://aurexara.ai',
  'https://www.aurexara.ai',
  'https://api.aurexara.ai',
  'http://localhost:3000',       // local dev
  'http://localhost:3001',       // local dev alternate
];

// ─── Rate Limiting (in-memory, resets on cold start) ───
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;  // 20 requests per minute per IP

const ipRequestMap = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = ipRequestMap.get(ip);

  if (!entry || (now - entry.windowStart) > RATE_LIMIT_WINDOW_MS) {
    // New window
    ipRequestMap.set(ip, { count: 1, windowStart: now });
    return false;
  }

  entry.count++;
  if (entry.count > MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  return false;
}

// ─── API Key Validation ───
function isValidApiKey(request: Request): boolean {
  const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
  
  const validKey = process.env['AUREXARA_API_KEY'];
  
  // If no API key is configured in env, allow all requests (dev mode)
  if (!validKey) {
    return true;
  }

  return apiKey === validKey;
}

// ─── CORS Check ───
function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  
  // No origin header = server-to-server call or same-origin, allow it
  if (!origin) return true;
  
  return ALLOWED_ORIGINS.includes(origin);
}

// ─── Get Client IP ───
function getClientIP(request: Request): string {
  // Vercel sets x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]!.trim();
  }
  return 'unknown';
}

/**
 * Main security check — call this at the top of every API route handler.
 * Returns null if allowed, or a NextResponse error if blocked.
 */
export function checkSecurity(request: Request): NextResponse | null {
  // 1. CORS check
  if (!isAllowedOrigin(request)) {
    return NextResponse.json(
      { error: 'Forbidden: Origin not allowed' },
      { status: 403 }
    );
  }

  // 2. API Key check
  if (!isValidApiKey(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing API key' },
      { status: 401 }
    );
  }

  // 3. Rate limit check
  const ip = getClientIP(request);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too Many Requests: Rate limit exceeded (20 req/min)' },
      { status: 429 }
    );
  }

  return null; // All checks passed
}

/**
 * CORS headers to add to successful responses.
 */
export function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
