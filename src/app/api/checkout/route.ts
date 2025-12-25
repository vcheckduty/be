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
 * Validate checkout request body
 */
interface CheckOutRequest {
  officeId: string;
  lat: number;
  lng: number;
}

function validateCheckOutRequest(body: any): {
  isValid: boolean;
  data?: CheckOutRequest;
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
 * POST /api/checkout
 * Handles officer checkout requests (requires authentication)
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
    const validation = validateCheckOutRequest(body);
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

    // Find today's check-in record
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const todayAttendance = await Attendance.findOne({
      user: user._id,
      office: office._id,
      checkinTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    }).sort({ checkinTime: -1 });

    if (!todayAttendance) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No check-in record found for today. Please check in first.' 
        },
        { status: 400 }
      );
    }

    // Check if already checked out
    if (todayAttendance.checkoutTime) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'You have already checked out today.' 
        },
        { status: 400 }
      );
    }

    // Calculate distance from office for checkout
    const checkoutDistance = calculateDistance(
      lat,
      lng,
      office.location.lat,
      office.location.lng
    );

    // Calculate total hours worked
    const checkoutTime = new Date();
    const checkinTime = new Date(todayAttendance.checkinTime);
    const timeDifferenceMs = checkoutTime.getTime() - checkinTime.getTime();
    const totalHours = Math.round((timeDifferenceMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places

    // Update attendance record with checkout information
    todayAttendance.checkoutTime = checkoutTime;
    todayAttendance.checkoutLocation = { lat, lng };
    todayAttendance.checkoutDistance = checkoutDistance;
    todayAttendance.totalHours = totalHours;
    await todayAttendance.save();

    return NextResponse.json(
      {
        success: true,
        message: 'Checkout successful',
        data: {
          attendanceId: todayAttendance._id,
          checkoutTime: checkoutTime,
          checkoutDistance: checkoutDistance,
          totalHours: totalHours,
          checkinTime: checkinTime,
          officeName: office.name,
          status: todayAttendance.status,
        },
      },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('❌ Checkout error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process checkout',
      },
      { status: 500 }
    );
  }
}
