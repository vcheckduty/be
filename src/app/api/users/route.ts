import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { UserRole } from '@/models/User';
import { extractTokenFromHeader, verifyToken, hasMinimumRole, hasRole } from '@/lib/auth';

/**
 * GET /api/users
 * Get all users (admin and supervisor can access)
 */
export async function GET(request: NextRequest) {
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authorization token is required' },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Check if user is admin or supervisor
    if (!hasRole(decoded.role, [UserRole.ADMIN, UserRole.SUPERVISOR])) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin or Supervisor privileges required.' },
        { status: 403 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    const isActive = searchParams.get('isActive');

    // Build query filter
    const filter: any = {};
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      filter.role = role;
    }
    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Fetch users (excluding password)
    const users = await User.find(filter)
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    // Transform users to include id field
    const usersWithId = users.map((user: any) => ({
      ...user,
      id: user._id.toString(),
    }));

    return NextResponse.json(
      {
        success: true,
        data: { users: usersWithId, total: usersWithId.length },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Get users error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
