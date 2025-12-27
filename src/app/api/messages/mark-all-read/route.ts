import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Message } from '@/models/Message';
import Conversation from '@/models/Conversation';
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
 * POST /api/messages/mark-all-read
 * Mark all messages from a specific user as read
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { senderId } = body;

    if (!senderId) {
      return NextResponse.json(
        { message: 'Sender ID is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const currentUserId = decoded.userId;

    // Mark all unread messages from senderId to currentUser as read
    const result = await Message.updateMany(
      {
        sender: senderId,
        receiver: currentUserId,
        status: { $ne: 'read' }
      },
      {
        $set: {
          status: 'read',
          readAt: new Date()
        }
      }
    );

    // Update conversation unread count
    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, currentUserId] }
    });

    if (conversation) {
      conversation.unreadCounts.set(currentUserId, 0);
      await conversation.save();
    }

    return NextResponse.json({
      success: true,
      message: 'All messages marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    }, { headers: getCorsHeaders(origin) });

  } catch (error) {
    console.error('Mark all read error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
