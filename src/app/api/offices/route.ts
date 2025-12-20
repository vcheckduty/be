import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Office from '@/models/Office';
import { extractTokenFromHeader, verifyToken, hasMinimumRole } from '@/lib/auth';
import { UserRole } from '@/models/User';

/**
 * GET /api/offices
 * Get all offices (public for officers to see check-in locations)
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

    // Connect to MongoDB
    await connectDB();

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('isActive');

    // Build query filter
    const filter: any = {};
    if (isActive !== null && isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Fetch offices
    const offices = await Office.find(filter).sort({ name: 1 }).lean();

    return NextResponse.json(
      {
        success: true,
        data: { offices, total: offices.length },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Get offices error:', error);

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

/**
 * POST /api/offices
 * Create a new office (admin only)
 */
export async function POST(request: NextRequest) {
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

    // Check if user is admin
    if (!hasMinimumRole(decoded.role, UserRole.ADMIN)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, address, location, radius, description, isActive } = body;

    // Validate required fields
    if (!name || !address || !location || !location.lat || !location.lng) {
      return NextResponse.json(
        { success: false, error: 'Name, address, and location (lat, lng) are required' },
        { status: 400 }
      );
    }

    // Connect to MongoDB
    await connectDB();

    // Create new office
    const office = await Office.create({
      name,
      address,
      location,
      radius: radius || 50,
      description,
      isActive: isActive !== undefined ? isActive : true,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Office created successfully',
        data: { office },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Create office error:', error);

    // Handle duplicate office name
    if (error.code === 11000) {
      return NextResponse.json(
        { success: false, error: 'Office name already exists' },
        { status: 409 }
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
        { status: 400 }
      );
    }

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
