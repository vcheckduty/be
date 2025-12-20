import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { generateToken } from '@/lib/auth';

/**
 * Validate login request body
 */
interface LoginRequest {
  username: string;
  password: string;
}

function validateLoginRequest(body: any): {
  isValid: boolean;
  data?: LoginRequest;
  error?: string;
} {
  if (!body) {
    return { isValid: false, error: 'Request body is required' };
  }

  const { username, password } = body;

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    return { isValid: false, error: 'Username is required' };
  }

  if (!password || typeof password !== 'string' || password.length === 0) {
    return { isValid: false, error: 'Password is required' };
  }

  return {
    isValid: true,
    data: {
      username: username.trim().toLowerCase(),
      password,
    },
  };
}

/**
 * POST /api/auth/login
 * Authenticate user and return JWT token
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate request data
    const validation = validateLoginRequest(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { username, password } = validation.data!;

    // Connect to MongoDB
    await connectDB();

    // Find user by username and include password field
    const user = await User.findOne({ username }).select('+password');
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Check if user account is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Please contact administrator.' },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid username or password' },
        { status: 401 }
      );
    }

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
        message: 'Login successful',
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
          },
          token,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('❌ Login error:', error);

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
