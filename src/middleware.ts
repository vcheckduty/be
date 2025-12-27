import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'http://localhost:3000',
  'https://vcheck-fe.onrender.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  // Handle preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    
    if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:'))) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, POST, PUT, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    
    return response;
  }

  // Handle simple requests
  const response = NextResponse.next();
  
  if (origin && (ALLOWED_ORIGINS.includes(origin) || origin.startsWith('http://localhost:'))) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, DELETE, PATCH, POST, PUT, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
