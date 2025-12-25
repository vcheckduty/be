import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import OTP from '@/models/OTP';
import { sendOTPEmail } from '@/lib/nodemailer';
import { handleCorsOptions, getCorsHeaders } from '@/lib/cors';

/**
 * OPTIONS /api/auth/send-otp
 * Handle CORS preflight
 */
export async function OPTIONS(request: NextRequest) {
  return handleCorsOptions(request);
}

/**
 * POST /api/auth/send-otp
 * Generate and send a 6-digit OTP code to the user's email
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  
  try {
    const { email } = await request.json();

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400, headers: getCorsHeaders(origin) }
      );
    }

    // Connect to database
    await dbConnect();

    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // 🔥 LOG OTP TO CONSOLE (visible in Render logs)
    console.log('═══════════════════════════════════════');
    console.log('📧 OTP REQUEST for:', email);
    console.log('🔑 OTP CODE:', code);
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('═══════════════════════════════════════');

    // Delete any existing OTP for this email (to prevent multiple active codes)
    await OTP.deleteMany({ email: email.toLowerCase() });

    // Save new OTP to database
    const otp = new OTP({
      email: email.toLowerCase(),
      code,
    });
    await otp.save();

    // Send OTP via email
    try {
      await sendOTPEmail(email, code);
      
      return NextResponse.json(
        {
          success: true,
          message: 'OTP sent successfully to your email',
          expiresIn: '5 minutes',
        },
        { status: 200, headers: getCorsHeaders(origin) }
      );
    } catch (emailError) {
      // If email fails, delete the OTP from database
      await OTP.deleteOne({ email: email.toLowerCase() });
      
      console.error('Email sending failed:', emailError);
      return NextResponse.json(
        { error: 'Failed to send OTP email. Please check your email configuration.' },
        { status: 500, headers: getCorsHeaders(origin) }
      );
    }

  } catch (error) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP. Please try again.' },
      { status: 500, headers: getCorsHeaders(origin) }
    );
  }
}
