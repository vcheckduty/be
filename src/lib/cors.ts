import { NextResponse } from 'next/server';

/**
 * CORS configuration
 */
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:4000',
  'http://localhost:5173',
  'http://localhost:5174',
  'https://vcheck-fe.onrender.com',
  'https://vcheck.onrender.com',
  // Add your production domains here
];

/**
 * Get CORS headers for the response
 * @param origin - The origin of the request
 * @returns Headers object with CORS configuration
 */
export function getCorsHeaders(origin?: string | null): HeadersInit {
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400', // 24 hours
  };

  // Check if origin is allowed
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:'))) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  } else if (!origin) {
    // If no origin is provided, allow all (for same-origin requests)
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
}

/**
 * Handle OPTIONS preflight request
 * @param request - The incoming request
 * @returns NextResponse with CORS headers
 */
export function handleCorsOptions(request: Request): NextResponse {
  const origin = request.headers.get('origin');
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

/**
 * Add CORS headers to a NextResponse
 * @param response - The NextResponse object
 * @param request - The incoming request
 * @returns The response with CORS headers added
 */
export function addCorsHeaders(response: NextResponse, request: Request): NextResponse {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  
  return response;
}
