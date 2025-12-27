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
 * GET /api/users/search
 * Search users for starting a conversation
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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '20');

    const users = await User.find({
      _id: { $ne: decoded.userId }, // Exclude current user
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { fullName: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
      isActive: true,
    })
      .select('username fullName email role department isOnline lastSeen')
      .limit(limit);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
