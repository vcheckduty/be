import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export async function sendOTPEmail(email: string, code: string) {
  try {
    const info = await transporter.sendMail({
      from: `"VCheck Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'VCheck Verification Code',
      text: `Your verification code is: ${code}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #2563eb;">VCheck Verification</h2>
          <p>Your verification code is:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #1e40af; margin: 20px 0;">${code}</h1>
          <p>This code will expire in 5 minutes.</p>
          <p style="font-size: 12px; color: #666; margin-top: 30px;">If you didn't request this code, please ignore this email.</p>
        </div>
      `,
    });
    
    console.log('Message sent: %s', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
