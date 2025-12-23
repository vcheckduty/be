import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Office from '@/models/Office';
import User, { UserRole } from '@/models/User';
import { extractTokenFromHeader, verifyToken, hasRole } from '@/lib/auth';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';
import mongoose from 'mongoose';

/**
 * OPTIONS /api/offices/[id]/members
 * Handle CORS preflight request
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * GET /api/offices/[id]/members
 * Get all members of an office
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const officeId = params.id;

    // Validate office ID
    if (!mongoose.Types.ObjectId.isValid(officeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid office ID' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Get office with members
    const office = await Office.findById(officeId).populate({
      path: 'members',
      select: 'username email fullName role badgeNumber department isActive',
    });

    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Office not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          officeId: office._id,
          officeName: office.name,
          members: office.members,
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Get members error:', error);
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
 * POST /api/offices/[id]/members
 * Add a member to an office (Supervisor or Admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if user is supervisor or admin
    if (!hasRole(decoded.role, [UserRole.SUPERVISOR, UserRole.ADMIN])) {
      return NextResponse.json(
        { success: false, error: 'Only supervisors and admins can add members to offices' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Parse request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to MongoDB
    await connectDB();

    const officeId = params.id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(officeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid office ID' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Get office
    const office = await Office.findById(officeId);
    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Office not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Check if user is already a member
    const userObjectId = new mongoose.Types.ObjectId(userId);
    if (office.members.some((memberId) => memberId.equals(userObjectId))) {
      return NextResponse.json(
        { success: false, error: 'User is already a member of this office' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Add user to office members
    office.members.push(userObjectId);
    await office.save();

    // Update user's officeId
    user.officeId = new mongoose.Types.ObjectId(officeId);
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: 'Member added successfully',
        data: {
          officeId: office._id,
          officeName: office.name,
          user: {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
          },
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Add member error:', error);
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
 * DELETE /api/offices/[id]/members
 * Remove a member from an office (Supervisor or Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Check if user is supervisor or admin
    if (!hasRole(decoded.role, [UserRole.SUPERVISOR, UserRole.ADMIN])) {
      return NextResponse.json(
        { success: false, error: 'Only supervisors and admins can remove members from offices' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Get userId from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to MongoDB
    await connectDB();

    const officeId = params.id;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(officeId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid office ID' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid user ID' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Get office
    const office = await Office.findById(officeId);
    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Office not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Remove user from office members
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const initialLength = office.members.length;
    office.members = office.members.filter((memberId) => !memberId.equals(userObjectId));
    
    if (office.members.length === initialLength) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this office' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    await office.save();

    // Remove user's officeId
    user.officeId = undefined;
    await user.save();

    return NextResponse.json(
      {
        success: true,
        message: 'Member removed successfully',
        data: {
          officeId: office._id,
          officeName: office.name,
          removedUser: {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
          },
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Remove member error:', error);
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
