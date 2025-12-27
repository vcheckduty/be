import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import { extractTokenFromHeader, verifyToken, hasMinimumRole } from '@/lib/auth';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS handler
 * Handle CORS preflight request
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}
import { UserRole } from '@/models/User';

/**
 * GET /api/attendance
 * Get attendance records (requires authentication)
 * Query params:
 * - startDate: Filter by start date (ISO string)
 * - endDate: Filter by end date (ISO string)
 * - status: Filter by status ('Valid' or 'Invalid')
 * - userId: Filter by specific user (admin/supervisor only)
 * - limit: Number of records to return (default: 50)
 * - page: Page number for pagination (default: 1)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const page = parseInt(searchParams.get('page') || '1');

    // Build query filter
    const filter: any = {};

    // If not admin/supervisor, only show own records
    if (!hasMinimumRole(decoded.role, UserRole.SUPERVISOR)) {
      filter.user = decoded.userId;
    } else if (userId) {
      // Admin/supervisor can filter by specific user
      filter.user = userId;
    }

    // Date filters
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Status filter
    if (status && (status === 'Valid' || status === 'Invalid')) {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Fetch records with pagination
    const [records, total] = await Promise.all([
      Attendance.find(filter)
        .populate('user', 'username fullName email badgeNumber department')
        .populate('office', 'name address location radius')
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Attendance.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json(
      {
        success: true,
        data: {
          records,
          pagination: {
            total,
            page,
            limit,
            totalPages,
            hasNextPage,
            hasPrevPage,
          },
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Get attendance error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
