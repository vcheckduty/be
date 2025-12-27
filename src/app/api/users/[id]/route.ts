import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { UserRole } from '@/models/User';
import { extractTokenFromHeader, verifyToken, hasMinimumRole } from '@/lib/auth';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS handler
 * Handle CORS preflight request
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * GET /api/users/[id]
 * Get user by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const userId = id;

    // Users can view their own profile, admins can view any profile
    if (decoded.userId !== userId && !hasMinimumRole(decoded.role, UserRole.ADMIN)) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Fetch user (excluding password)
    const user = await User.findById(userId).select('-password').lean();

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { user },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Get user error:', error);

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

/**
 * PATCH /api/users/[id]
 * Update user (admin only or own profile for basic fields)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const userId = id;
    const body = await request.json();

    const isAdmin = hasMinimumRole(decoded.role, UserRole.ADMIN);
    const isOwnProfile = decoded.userId === userId;

    if (!isAdmin && !isOwnProfile) {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Allowed fields based on role
    const allowedFields = isAdmin
      ? ['fullName', 'email', 'badgeNumber', 'department', 'role', 'isActive']
      : ['fullName', 'email', 'badgeNumber', 'department'];

    // Filter update data
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Validate role if being updated
    if (updateData.role && !Object.values(UserRole).includes(updateData.role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role specified' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Update user
    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'User updated successfully',
        data: { user },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Update user error:', error);

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: Object.values(error.errors).map((err: any) => err.message),
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

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

/**
 * DELETE /api/users/[id]
 * Delete user (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Check if user is admin
    if (!hasMinimumRole(decoded.role, UserRole.ADMIN)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin privileges required.' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to MongoDB
    await connectDB();

    const { id } = await params;
    const userId = id;

    // Prevent admin from deleting themselves
    if (decoded.userId === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete your own account' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Delete user
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'User deleted successfully',
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Delete user error:', error);

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
