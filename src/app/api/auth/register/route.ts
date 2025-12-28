import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User, { UserRole } from '@/models/User';
import { generateToken } from '@/lib/auth';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS /api/auth/register
 * Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * Validate registration request body
 */
interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
  badgeNumber?: string;
  department?: string;
}

function validateRegisterRequest(body: any): {
  isValid: boolean;
  data?: RegisterRequest;
  error?: string;
} {
  if (!body) {
    return { isValid: false, error: 'Yêu cầu dữ liệu request body' };
  }

  const { username, email, password, fullName, role, badgeNumber, department } = body;

  // Required fields validation
  if (!username || typeof username !== 'string' || username.trim().length < 3) {
    return { isValid: false, error: 'Tên đăng nhập phải có ít nhất 3 ký tự' };
  }

  if (!email || typeof email !== 'string' || !email.match(/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/)) {
    return { isValid: false, error: 'Yêu cầu địa chỉ email hợp lệ' };
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return { isValid: false, error: 'Mật khẩu phải có ít nhất 6 ký tự' };
  }

  if (!fullName || typeof fullName !== 'string' || fullName.trim().length === 0) {
    return { isValid: false, error: 'Yêu cầu họ tên đầy đủ' };
  }

  // Optional fields validation
  if (role && !Object.values(UserRole).includes(role)) {
    return { isValid: false, error: 'Vai trò không hợp lệ' };
  }

  return {
    isValid: true,
    data: {
      username: username.trim().toLowerCase(),
      email: email.trim().toLowerCase(),
      password,
      fullName: fullName.trim(),
      role: role || UserRole.OFFICER,
      badgeNumber: badgeNumber?.trim(),
      department: department?.trim(),
    },
  };
}

/**
 * POST /api/auth/register
 * Register a new user
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = validateRegisterRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    const userData = validation.data!;

    // Connect to MongoDB
    await connectDB();

    // Check if username already exists
    const existingUsername = await User.findOne({ username: userData.username });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, error: 'Tên đăng nhập đã tồn tại' },
        { status: 409, headers: getCorsHeaders(origin) }
      );
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: userData.email });
    if (existingEmail) {
      return NextResponse.json(
        { success: false, error: 'Email đã tồn tại' },
        { status: 409, headers: getCorsHeaders(origin) }
      );
    }

    // Create new user with isActive=false (will be activated after OTP verification)
    const user = await User.create({
      ...userData,
      isActive: false,
    });

    // Generate JWT token
    const token = generateToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    });

    // Return success response (excluding password)
    return NextResponse.json(
      {
        success: true,
        message: 'Đăng ký người dùng thành công',
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            fullName: user.fullName,
            role: user.role,
            badgeNumber: user.badgeNumber,
            department: user.department,
            isActive: user.isActive,
            createdAt: user.createdAt,
          },
          token,
        },
      },
      { status: 201, headers: getCorsHeaders(origin) }
    );
  } catch (error: any) {
    console.error('❌ Registration error:', error);

    // Handle MongoDB duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return NextResponse.json(
        { success: false, error: `${field} đã tồn tại` },
        { status: 409, headers: getCorsHeaders(origin) }
      );
    }

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
        { success: false, error: 'JSON không hợp lệ trong request body' },
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
