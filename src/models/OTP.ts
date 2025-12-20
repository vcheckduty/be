import mongoose, { Schema, Document } from 'mongoose';

export interface IOTP extends Document {
  email: string;
  code: string;
  createdAt: Date;
}

const OTPSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  code: {
    type: String,
    required: true,
    length: 6,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300, // TTL index: document expires after 5 minutes (300 seconds)
  },
});

// Create index on email for faster lookups
OTPSchema.index({ email: 1 });

export default mongoose.models.OTP || mongoose.model<IOTP>('OTP', OTPSchema);
