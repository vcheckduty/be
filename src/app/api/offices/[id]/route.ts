import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Office from '@/models/Office';
import { extractTokenFromHeader, verifyToken, hasMinimumRole } from '@/lib/auth';
import { UserRole } from '@/models/User';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS /api/offices/[id]
 * Handle CORS preflight request
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * GET /api/offices/[id]
 * Get office by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id: officeId } = await params;

    // Fetch office
    const office = await Office.findById(officeId).lean();

    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Office not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: { office },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Get office error:', error);

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
 * PATCH /api/offices/[id]
 * Update office (admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if user is admin
    if (!hasMinimumRole(decoded.role, UserRole.ADMIN)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin privileges required.' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to MongoDB
    await connectDB();

    const { id: officeId } = await params;
    const body = await request.json();

    // Allowed fields
    const allowedFields = ['name', 'address', 'location', 'radius', 'description', 'isActive'];

    // Filter update data
    const updateData: any = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Update office
    const office = await Office.findByIdAndUpdate(officeId, updateData, {
      new: true,
      runValidators: true,
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
        message: 'Office updated successfully',
        data: { office },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Update office error:', error);

    // Handle duplicate office name
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Office name already exists' },
        { status: 409, headers: getCorsHeaders(origin) }
      );
    }

    // Handle validation errors
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
 * DELETE /api/offices/[id]
 * Delete office (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check if user is admin
    if (!hasMinimumRole(decoded.role, UserRole.ADMIN)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin privileges required.' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to MongoDB
    await connectDB();

    const { id: officeId } = await params;

    // Delete office
    const office = await Office.findByIdAndDelete(officeId);

    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Office not found' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Office deleted successfully',
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Delete office error:', error);

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
