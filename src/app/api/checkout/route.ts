import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Attendance from '@/models/Attendance';
import User from '@/models/User';
import Office from '@/models/Office';
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
  photo?: string; // Base64 encoded photo (optional)
}

function validateCheckOutRequest(body: any): {
  isValid: boolean;
  data?: CheckOutRequest;
  error?: string;
} {
  if (!body) {
    return { isValid: false, error: 'Thiếu dữ liệu yêu cầu' };
  }

  const { officeId, lat, lng } = body;

  if (!officeId || typeof officeId !== 'string') {
    return { isValid: false, error: 'Yêu cầu ID trụ sở' };
  }

  if (typeof lat !== 'number' || isNaN(lat) || lat < -90 || lat > 90) {
    return { isValid: false, error: 'Kinh độ không hợp lệ (-90 đến 90)' };
  }

  if (typeof lng !== 'number' || isNaN(lng) || lng < -180 || lng > 180) {
    return { isValid: false, error: 'Vĩ độ không hợp lệ (-180 đến 180)' };
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
  const origin = request.headers.get('origin');
  try {
    // Extract and verify JWT token
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Yêu cầu token xác thực' },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Token không hợp lệ hoặc đã hết hạn' },
        { status: 401, headers: getCorsHeaders(origin) }
      );
    }

    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = validateCheckOutRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const { officeId, lat, lng } = validation.data!;
    const photo = body.photo; // Optional photo

    // Connect to MongoDB
    await connectDB();

    // Get user details
    const user = await User.findById(decoded.userId);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy người dùng' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Tài khoản đã bị vô hiệu hóa' },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Get office details
    const office = await Office.findById(officeId);
    if (!office) {
      return NextResponse.json(
        { success: false, error: 'Không tìm thấy trụ sở' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    if (!office.isActive) {
      return NextResponse.json(
        { success: false, error: 'Trụ sở không hoạt động' },
        { status: 403, headers: getCorsHeaders(origin) }
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
          error: 'Không tìm thấy bản ghi chấm công hôm nay. Vui lòng chấm công vào trước.' 
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Check if already checked out
    if (todayAttendance.checkoutTime) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bạn đã kết thúc ca làm hôm nay rồi.' 
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Calculate distance from office for checkout
    const checkoutDistance = calculateDistance(
      lat,
      lng,
      office.location.lat,
      office.location.lng
    );

    // Determine if within range
    const isWithinRange = checkoutDistance <= office.radius;
    const checkoutStatus = 'pending'; // Always pending, waiting for supervisor approval

    // Calculate total hours worked
    const checkoutTime = new Date();
    const checkinTime = new Date(todayAttendance.checkinTime);
    const timeDifferenceMs = checkoutTime.getTime() - checkinTime.getTime();
    const totalHours = Math.round((timeDifferenceMs / (1000 * 60 * 60)) * 100) / 100; // Round to 2 decimal places

    // Update attendance record with checkout information
    todayAttendance.checkoutTime = checkoutTime;
    todayAttendance.checkoutLocation = { lat, lng };
    todayAttendance.checkoutDistance = checkoutDistance;
    todayAttendance.checkoutStatus = checkoutStatus;
    todayAttendance.totalHours = totalHours;
    todayAttendance.checkoutPhoto = photo; // Save photo if provided
    await todayAttendance.save();

    // Return appropriate message based on distance
    const message = isWithinRange
      ? `Check-out submitted successfully! You are ${checkoutDistance}m away from ${office.name}. Waiting for supervisor approval.`
      : `Check-out submitted but you are ${checkoutDistance}m away from ${office.name} (required: within ${office.radius}m). Please provide a reason. Waiting for supervisor approval.`;

    return NextResponse.json(
      {
        success: true,
        message,
        data: {
          attendanceId: todayAttendance._id,
          checkoutTime: checkoutTime,
          checkoutDistance: checkoutDistance,
          checkoutStatus,
          isWithinRange,
          requiredRadius: office.radius,
          totalHours: totalHours,
          checkinTime: checkinTime,
          officeName: office.name,
          status: todayAttendance.status,
          needsReason: !isWithinRange,
        },
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );

  } catch (error: any) {
    console.error('❌ Checkout error:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Xử lý kết thúc ca làm thất bại',
      },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
