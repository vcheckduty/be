# Email OTP Verification Setup Guide

## Overview
This guide explains how to set up and use the Email OTP (One-Time Password) verification feature in the V-Check application.

## Features Implemented

### 1. OTP Model (`src/models/OTP.ts`)
- Stores OTP codes with email addresses
- Automatic expiration after 5 minutes using MongoDB TTL index
- 6-digit numeric code format

### 2. Nodemailer Utility (`src/lib/nodemailer.ts`)
- Gmail SMTP transporter configuration
- Professional email template themed for Police Department
- Robust error handling
- Email verification on startup

### 3. Send OTP API (`src/app/api/auth/send-otp/route.ts`)
- **Endpoint**: `POST /api/auth/send-otp`
- **Request Body**: 
  ```json
  {
    "email": "user@example.com"
  }
  ```
- **Response** (Success):
  ```json
  {
    "success": true,
    "message": "OTP sent successfully to your email",
    "expiresIn": "5 minutes"
  }
  ```
- **Features**:
  - Generates random 6-digit code
  - Deletes previous OTP codes for the same email
  - Sends professional email with Police theme
  - Email format validation

### 4. Verify OTP API (`src/app/api/auth/verify-otp/route.ts`)
- **Endpoint**: `POST /api/auth/verify-otp`
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "code": "123456"
  }
  ```
- **Response** (Success):
  ```json
  {
    "success": true,
    "message": "Email verified successfully",
    "email": "user@example.com"
  }
  ```
- **Features**:
  - Validates OTP code
  - One-time use (deleted after successful verification)
  - Case-sensitive email matching

## Setup Instructions

### Step 1: Configure Gmail App Password

1. **Enable 2-Step Verification**:
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification"

2. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" and "Other (Custom name)"
   - Enter "V-Check OTP" as the name
   - Click "Generate"
   - Copy the 16-character password (no spaces)

3. **Update Environment Variables**:
   Edit `/vcheckbe/.env.local`:
   ```env
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=your-16-char-app-password
   ```

### Step 2: Verify MongoDB TTL Index

The OTP model automatically creates a TTL index. To verify:

```bash
# Connect to MongoDB
mongosh

# Switch to vcheck database
use vcheck

# Check indexes
db.otps.getIndexes()

# You should see an index on 'createdAt' with expireAfterSeconds: 300
```

### Step 3: Test the Implementation

#### Test Send OTP:
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

#### Test Verify OTP:
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "code": "123456"}'
```

## Email Template

The OTP email includes:
- 🚔 V-Check Police System branding
- Professional blue gradient header
- Large, clear 6-digit code display
- Security warnings
- 5-minute expiration notice
- Responsive design

## Integration with Registration Flow

### Example Flow:

1. **User Registration**:
   ```javascript
   // Step 1: User fills registration form
   const registrationData = {
     name: "John Doe",
     email: "john@example.com",
     password: "securepassword",
     role: "officer"
   };
   
   // Step 2: Send OTP to email
   await fetch('/api/auth/send-otp', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ email: registrationData.email })
   });
   
   // Step 3: User enters OTP code
   const otpCode = prompt("Enter OTP code from your email:");
   
   // Step 4: Verify OTP
   const verifyResponse = await fetch('/api/auth/verify-otp', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ 
       email: registrationData.email, 
       code: otpCode 
     })
   });
   
   // Step 5: If verified, proceed with registration
   if (verifyResponse.ok) {
     await fetch('/api/auth/register', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify(registrationData)
     });
   }
   ```

## Security Considerations

1. **Rate Limiting**: Consider adding rate limiting to prevent OTP spam
2. **IP Tracking**: Log IP addresses for OTP requests
3. **Brute Force Protection**: Limit verification attempts per email
4. **HTTPS Only**: Always use HTTPS in production
5. **Email Verification**: Ensure GMAIL_USER and GMAIL_APP_PASSWORD are secure

## Troubleshooting

### Issue: "Failed to send OTP email"

**Solutions**:
- Verify Gmail credentials in `.env.local`
- Check if 2-Step Verification is enabled
- Ensure App Password is correct (16 characters, no spaces)
- Check if Gmail is blocking "Less secure apps" (use App Password instead)

### Issue: "No OTP found for this email"

**Solutions**:
- OTP may have expired (5 minutes)
- Email might be case-sensitive
- User may need to request a new OTP

### Issue: "Invalid OTP code"

**Solutions**:
- Check for typos in the 6-digit code
- Ensure code hasn't been used already (one-time use)
- Request a new OTP if expired

### Issue: Nodemailer connection errors

**Check**:
```bash
# View server logs
npm run dev

# You should see: "✅ Nodemailer is ready to send emails"
# If error: "❌ Nodemailer transporter error: ..."
```

## API Error Responses

### Send OTP Errors:
- `400`: Invalid email format
- `500`: Failed to send email or database error

### Verify OTP Errors:
- `400`: Invalid code format or code doesn't match
- `404`: No OTP found for email
- `500`: Database error

## Database Schema

```javascript
{
  email: String (required, lowercase, trimmed),
  code: String (required, 6 digits),
  createdAt: Date (auto-expires after 300 seconds)
}
```

## Next Steps

To fully integrate OTP verification:

1. **Update Register Page** (`/vcheck/app/register/page.tsx`):
   - Add OTP input field
   - Call send-otp API before registration
   - Verify OTP before final registration

2. **Update User Model** (optional):
   - Add `emailVerified` boolean field
   - Update after successful OTP verification

3. **Add Frontend Components**:
   - OTP Input component with 6 boxes
   - Countdown timer (5 minutes)
   - Resend OTP button

4. **Production Deployment**:
   - Set up production Gmail account or use SendGrid/AWS SES
   - Configure domain authentication
   - Add monitoring for email delivery

## Support

For issues or questions, check:
- MongoDB connection
- Gmail SMTP settings
- Server logs (`npm run dev`)
- Network connectivity

---

**Created**: December 20, 2025  
**Version**: 1.0  
**Last Updated**: December 20, 2025
