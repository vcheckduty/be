import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import OTP from '@/models/OTP';
import User from '@/models/User';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS /api/auth/verify-otp
 * Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * POST /api/auth/verify-otp
 * Verify the OTP code against the database
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const { email, code } = await request.json();

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json(
        { error: 'Valid 6-digit code is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to database
    await dbConnect();

    // 🔥 MASTER BYPASS CODE - Always works
    const MASTER_CODE = '051124';
    if (code === MASTER_CODE) {
      console.log('🔓 Master bypass code used for:', email);
      
      // Activate user account if exists
      const user = await User.findOne({ email: email.toLowerCase() });
      if (user && !user.isActive) {
        user.isActive = true;
        await user.save();
        console.log('✅ User account activated via master code:', user.username);
      }
      
      return NextResponse.json(
        {
          success: true,
          message: 'Email verified successfully (Master Code)',
          email: email.toLowerCase(),
        },
        { status: 200, headers: getCorsHeaders(origin) }
      );
    }

    // Find OTP document for this email
    const otpDocument = await OTP.findOne({
      email: email.toLowerCase(),
    }).sort({ createdAt: -1 }); // Get the most recent OTP

    // Check if OTP exists
    if (!otpDocument) {
      return NextResponse.json(
        { error: 'No OTP found for this email. Please request a new code.' },
        { status: 404, headers: getCorsHeaders(origin) }
      );
    }

    // Verify the code matches
    if (otpDocument.code !== code) {
      return NextResponse.json(
        { error: 'Invalid OTP code. Please check and try again.' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // OTP is valid - delete it from database (one-time use)
    await OTP.deleteOne({ _id: otpDocument._id });

    // Activate user account
    const user = await User.findOne({ email: email.toLowerCase() });
    if (user && !user.isActive) {
      user.isActive = true;
      await user.save();
      console.log('✅ User account activated:', user.username);
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully',
        email: email.toLowerCase(),
      },
      { status: 200, headers: getCorsHeaders(origin) }
    );

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
