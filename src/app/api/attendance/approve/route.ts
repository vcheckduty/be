import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import User, { UserRole } from '@/models/User';
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
 * POST /api/attendance/approve
 * Supervisor approves or rejects check-in/check-out requests
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

    // Get supervisor details
    const supervisor = await User.findById(decoded.userId);
    if (!supervisor) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Check if user is a supervisor or admin
    if (supervisor.role !== UserRole.SUPERVISOR && supervisor.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Only supervisors can approve attendance' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { attendanceId, action, type, rejectionReason } = body;

    // Validate input
    if (!attendanceId || typeof attendanceId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Attendance ID is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'Action must be either "approve" or "reject"' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!type || !['checkin', 'checkout'].includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be either "checkin" or "checkout"' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // If rejecting, require a reason
    if (action === 'reject' && !rejectionReason) {
      return NextResponse.json(
        { success: false, error: 'Rejection reason is required when rejecting' },
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

    // Check if supervisor is authorized to approve this attendance
    // Supervisor can only approve attendance for their office
    if (supervisor.role === UserRole.SUPERVISOR) {
      if (!supervisor.officeId || supervisor.officeId.toString() !== attendance.office.toString()) {
        return NextResponse.json(
          { success: false, error: 'You can only approve attendance for your office' },
          { status: 403, headers: getCorsHeaders(origin) }
        );
      }
    }

    const now = new Date();

    if (type === 'checkin') {
      // Check if already processed
      if (attendance.checkinStatus !== 'pending') {
        return NextResponse.json(
          { success: false, error: `Check-in already ${attendance.checkinStatus}` },
          { status: 400, headers: getCorsHeaders(origin) }
        );
      }

      // Update check-in status
      attendance.checkinStatus = action === 'approve' ? 'approved' : 'rejected';
      attendance.checkinApprovedBy = supervisor._id;
      attendance.checkinApprovedAt = now;
      
      // Save rejection reason if rejecting
      if (action === 'reject' && rejectionReason) {
        attendance.checkinRejectionReason = rejectionReason;
      }
    } else {
      // Check if already processed
      if (attendance.checkoutStatus && attendance.checkoutStatus !== 'pending') {
        return NextResponse.json(
          { success: false, error: `Check-out already ${attendance.checkoutStatus}` },
          { status: 400, headers: getCorsHeaders(origin) }
        );
      }

      // Update check-out status
      attendance.checkoutStatus = action === 'approve' ? 'approved' : 'rejected';
      attendance.checkoutApprovedBy = supervisor._id;
      attendance.checkoutApprovedAt = now;
      
      // Save rejection reason if rejecting
      if (action === 'reject' && rejectionReason) {
        attendance.checkoutRejectionReason = rejectionReason;
      }
    }

    await attendance.save();

    return NextResponse.json(
      {
        success: true,
        message: `${type === 'checkin' ? 'Check-in' : 'Check-out'} ${action === 'approve' ? 'approved' : 'rejected'} successfully`,
        data: {
          attendanceId: attendance._id,
          type,
          status: action === 'approve' ? 'approved' : 'rejected',
          approvedBy: supervisor.fullName,
          approvedAt: now,
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Approval error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process approval',
      },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}

/**
 * GET /api/attendance/approve
 * Get pending attendance records for supervisor to review
 */
export async function GET(request: NextRequest) {
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

    // Get supervisor details
    const supervisor = await User.findById(decoded.userId);
    if (!supervisor) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Check if user is a supervisor or admin
    if (supervisor.role !== UserRole.SUPERVISOR && supervisor.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { success: false, error: 'Only supervisors can view pending attendance' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Build query based on role
    const query: any = {
      $or: [
        { checkinStatus: 'pending' },
        { checkoutStatus: 'pending' },
      ],
    };

    // Supervisors can only see their office's attendance
    if (supervisor.role === UserRole.SUPERVISOR && supervisor.officeId) {
      query.office = supervisor.officeId;
    }

    // Get pending attendance records
    const pendingAttendance = await Attendance.find(query)
      .populate('user', 'fullName email badgeNumber')
      .populate('office', 'name')
      .sort({ checkinTime: -1 })
      .limit(100);

    return NextResponse.json(
      {
        success: true,
        data: pendingAttendance,
        count: pendingAttendance.length,
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Get pending attendance error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch pending attendance',
      },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
