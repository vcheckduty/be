import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
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
 * POST /api/attendance/reason
 * Officer adds reason and photo for out-of-range check-in/check-out
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authorization token is required' },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Get user details
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { attendanceId, type, reason, reasonPhoto } = body;

    // Validate input
    if (!attendanceId || typeof attendanceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Attendance ID is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!type || !['checkin', 'checkout'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be either "checkin" or "checkout"' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Reason is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Find the attendance record
    const attendance = await Attendance.findById(attendanceId);
    if (!attendance) {
      return NextResponse.json(
        { success: false, error: 'Attendance record not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Verify that this attendance belongs to the user
    if (attendance.user.toString() !== user._id.toString()) {
      return NextResponse.json(
        { success: false, error: 'You can only add reason to your own attendance' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Update reason based on type
    if (type === 'checkin') {
      attendance.checkinReason = reason;
      if (reasonPhoto) {
        attendance.checkinReasonPhoto = reasonPhoto;
      }
    } else {
      attendance.checkoutReason = reason;
      if (reasonPhoto) {
        attendance.checkoutReasonPhoto = reasonPhoto;
      }
    }

    await attendance.save();

    return NextResponse.json(
      {
        success: true,
        message: `Reason added successfully for ${type}`,
        data: {
          attendanceId: attendance._id,
          type,
          reason,
          hasReasonPhoto: !!reasonPhoto,
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Add reason error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to add reason',
      },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
