import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS handler
 * Handle CORS preflight request
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * GET /api/users/supervisor
 * Get supervisor for current officer
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { message: 'Invalid token' },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    await dbConnect();

    // Only officers can use this endpoint
    if (decoded.role !== 'officer') {
      return NextResponse.json(
        { message: 'Only officers can access this endpoint' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Get current user's officeId
    const currentUser = await User.findById(decoded.userId).select('officeId');
    if (!currentUser || !currentUser.officeId) {
      return NextResponse.json(
        { message: 'User office not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Find supervisor with same officeId
    const supervisor = await User.findOne({
      role: 'supervisor',
      officeId: currentUser.officeId,
      isActive: true,
    }).select('username fullName email role department isOnline lastSeen officeId');

    if (!supervisor) {
      return NextResponse.json(
        { message: 'No supervisor found for your office' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json({ supervisor });
  } catch (error) {
    console.error('Get supervisor error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
