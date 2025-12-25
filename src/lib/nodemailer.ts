/**
 * Send OTP email - DEV MODE: Only logs to console
 * No email sending needed - OTP is logged in send-otp route
 */
export async function sendOTPEmail(email: string, code: string) {
  console.log('📧 Sending OTP to:', email);
  console.log('🔑 OTP Code:', code);
  
  // Just return success - actual logging happens in the API route
  return { success: true, messageId: 'console-only', devMode: true };
}
