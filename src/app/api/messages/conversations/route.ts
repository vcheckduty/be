import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { Message } from '@/models/Message';
import Conversation from '@/models/Conversation';
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
 * GET /api/messages/conversations
 * Get list of conversations for current user
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

    const userId = decoded.userId;

    // Find conversations where user is a participant
    const conversations = await Conversation.find({
      participants: userId
    })
    .populate('participants', 'username fullName isOnline lastSeen')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

    // Format response
    const formattedConversations = conversations.map(conv => {
      // Find the other participant
      const otherUser = conv.participants.find((p: any) => p._id.toString() !== userId);
      
      if (!otherUser) return null;

      return {
        userId: otherUser._id,
        username: otherUser.username,
        fullName: otherUser.fullName,
        isOnline: otherUser.isOnline,
        lastSeen: otherUser.lastSeen,
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCounts.get(userId) || 0
      };
    }).filter(Boolean);

    return NextResponse.json({ conversations: formattedConversations }, { headers: getCorsHeaders(origin) });
  } catch (error) {
    console.error('Get conversations error:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
