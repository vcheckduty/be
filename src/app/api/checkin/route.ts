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
 * Validate check-in request body
 */
interface CheckInRequest {
  officeId: string;
  lat: number;
  lng: number;
  photo?: string; // Base64 encoded photo (optional)
}

function validateCheckInRequest(body: any): {
  isValid: boolean;
  data?: CheckInRequest;
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
 * POST /api/checkin
 * Handles officer check-in requests (requires authentication)
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
    const validation = validateCheckInRequest(body);
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

    // Check if user has been assigned to an office
    if (!user.officeId) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bạn chưa được phân công vào trụ sở nào. Vui lòng liên hệ người giám sát.' 
        },
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

    // Check if user is a member of this office
    const userObjectId = user._id;
    const isMember = office.members.some((memberId) => 
      memberId.toString() === userObjectId.toString()
    );

    if (!isMember) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bạn không được phép chấm công tại trụ sở này. Vui lòng liên hệ người giám sát để được thêm vào danh sách thành viên.' 
        },
        { status: 403, headers: getCorsHeaders(origin) }
      );
    }

    // Calculate distance from office
    const distance = calculateDistance(
      lat,
      lng,
      office.location.lat,
      office.location.lng
    );

    // Determine if within range
    const isWithinRange = distance <= office.radius;
    const status = isWithinRange ? 'Valid' : 'Invalid';
    const checkinStatus = 'pending'; // Always pending, waiting for supervisor approval

    // Check if user has already checked in today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existingCheckin = await Attendance.findOne({
      user: user._id,
      checkinTime: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    });

    if (existingCheckin) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Bạn đã chấm công hôm nay rồi. Mỗi ngày chỉ được chấm công một lần.' 
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Save attendance record (even if out of range)
    const attendance = await Attendance.create({
      user: user._id,
      office: office._id,
      officerName: user.fullName,
      officeName: office.name,
      location: { lat, lng },
      distance,
      status,
      checkinStatus,
      checkinTime: new Date(),
      checkinPhoto: photo,
    });

    // Return appropriate message based on distance
    const message = isWithinRange
      ? `Chấm công thành công tại ${office.name}! Bạn cách ${distance}m. Đang chờ người giám sát phê duyệt.`
      : `Đã gửi chấm công nhưng bạn cách ${distance}m từ ${office.name} (yêu cầu: trong vòng ${office.radius}m). Vui lòng cung cấp lý do. Đang chờ người giám sát phê duyệt.`;

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
          checkinStatus,
          isWithinRange,
          requiredRadius: office.radius,
          checkinTime: attendance.checkinTime,
          message,
          needsReason: !isWithinRange,
        },
      },
      { status: 201, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Check-in error:', error);

    // Handle MongoDB validation errors
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        {
          success: false,
          error: 'Lỗi xác thực dữ liệu',
          details: Object.values(error.errors).map((err: any) => err.message),
        },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Dữ liệu JSON không hợp lệ' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Generic server error
    return NextResponse.json(
      {
        success: false,
        error: 'Lỗi máy chủ nội bộ',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
