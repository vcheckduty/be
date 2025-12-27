import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Message } from '@/models/Message';
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
 * GET /api/messages
 * Get messages between current user and another user
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
    const otherUserId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');

    if (!otherUserId) {
      return NextResponse.json(
        { message: 'User ID is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Get messages between current user and the other user
    const messages = await Message.find({
      $or: [
        { sender: decoded.userId, receiver: otherUserId },
        { sender: otherUserId, receiver: decoded.userId },
      ],
    })
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .populate('sender', 'username fullName')
      .populate('receiver', 'username fullName');

    return NextResponse.json({
      messages: messages.reverse(), // Reverse to show oldest first
      hasMore: messages.length === limit,
    });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
