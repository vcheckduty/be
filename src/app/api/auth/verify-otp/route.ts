import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import OTP from '@/models/OTP';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * OPTIONS /api/auth/verify-otp
 * Handle CORS preflight
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/auth/verify-otp
 * Verify the OTP code against the database
 */
export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    // Validate input
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!code || typeof code !== 'string' || code.length !== 6) {
      return NextResponse.json(
        { error: 'Valid 6-digit code is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Connect to database
    await dbConnect();

    // Find OTP document for this email
    const otpDocument = await OTP.findOne({
      email: email.toLowerCase(),
    }).sort({ createdAt: -1 }); // Get the most recent OTP

    // Check if OTP exists
    if (!otpDocument) {
      return NextResponse.json(
        { error: 'No OTP found for this email. Please request a new code.' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify the code matches
    if (otpDocument.code !== code) {
      return NextResponse.json(
        { error: 'Invalid OTP code. Please check and try again.' },
        { status: 400, headers: corsHeaders }
      );
    }

    // OTP is valid - delete it from database (one-time use)
    await OTP.deleteOne({ _id: otpDocument._id });

    return NextResponse.json(
      {
        success: true,
        message: 'Email verified successfully',
        email: email.toLowerCase(),
      },
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Verify OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP. Please try again.' },
      { status: 500, headers: corsHeaders }
    );
  }
}
