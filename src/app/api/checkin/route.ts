import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import Office from '@/models/Office';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lng1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lng2 - Longitude of point 2
 * @returns Distance in meters
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const EARTH_RADIUS_KM = 6371; // Earth's radius in kilometers
  
  // Convert degrees to radians
  const toRadians = (degrees: number): number => degrees * (Math.PI / 180);
  
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  // Distance in kilometers, then convert to meters
  const distanceKm = EARTH_RADIUS_KM * c;
  const distanceMeters = distanceKm * 1000;
  
  return Math.round(distanceMeters * 100) / 100; // Round to 2 decimal places
}

/**
 * Validate check-in request body
 */
interface CheckInRequest {
  officeId: string;
  lat: number;
  lng: number;
}

function validateCheckInRequest(body: any): {
  isValid: boolean;
  data?: CheckInRequest;
  error?: string;
} {
  if (!body) {
    return { isValid: false, error: 'Request body is required' };
  }

  const { officeId, lat, lng } = body;

  if (!officeId || typeof officeId !== 'string') {
    return { isValid: false, error: 'Office ID is required' };
  }

  if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
    return { isValid: false, error: 'Valid latitude is required (-90 to 90)' };
  }

  if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
    return { isValid: false, error: 'Valid longitude is required (-180 to 180)' };
  }

  return {
    isValid: true,
    data: { officeId, lat, lng },
  };
}

/**
 * POST /api/checkin
 * Handles officer check-in requests (requires authentication)
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

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = validateCheckInRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { officeId, lat, lng } = validation.data!;

    // Connect to MongoDB
    await connectDB();

    // Get user details
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    // Get office details
    const office = await Office.findById(officeId);
    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Office not found' },
        { status: 404 }
      );
    }

    if (!office.isActive) {
      return NextResponse.json(
        { success: false, error: 'Office is not active' },
        { status: 403 }
      );
    }

    // Check if user is a member of this office
    const userObjectId = user._id;
    const isMember = office.members.some((memberId) => 
      memberId.toString() === userObjectId.toString()
    );

    if (!isMember) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You are not authorized to check in at this office. Please contact your supervisor to be added as a member.' 
        },
        { status: 403 }
      );
    }

    // Calculate distance from office
    const distance = calculateDistance(
      lat,
      lng,
      office.location.lat,
      office.location.lng
    );

    // Determine check-in status based on distance and office radius
    const status = distance <= office.radius ? 'Valid' : 'Invalid';

    // Save attendance record to database
    const attendance = await Attendance.create({
      user: user._id,
      office: office._id,
      officerName: user.fullName,
      officeName: office.name,
      location: { lat, lng },
      distance,
      status,
      timestamp: new Date(),
    });

    // Return success response
    return NextResponse.json(
      {
        success: true,
        data: {
          id: attendance._id,
          userId: user._id,
          officeId: office._id,
          officerName: attendance.officerName,
          officeName: attendance.officeName,
          distance,
          status,
          timestamp: attendance.timestamp,
          message:
            status === 'Valid'
              ? `Check-in successful at ${office.name}! You are ${distance}m away.`
              : `Check-in failed. You are ${distance}m from ${office.name} (maximum allowed: ${office.radius}m).`,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('❌ Check-in error:', error);

    // Handle MongoDB validation errors
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

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Generic server error
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
