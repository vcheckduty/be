import mongoose, { Schema, Model, Document, Types } from 'mongoose';

/**
 * Interface for Attendance document
 */
export interface IAttendance extends Document {
  user: Types.ObjectId;
  office: Types.ObjectId;
  officerName: string;
  officeName: string;
  location: {
    lat: number;
    lng: number;
  };
  distance: number;
  status: 'Valid' | 'Invalid';
  
  // Check-in approval workflow
  checkinStatus: 'pending' | 'approved' | 'rejected';
  checkinApprovedBy?: Types.ObjectId; // Supervisor who approved/rejected
  checkinApprovedAt?: Date;
  checkinRejectionReason?: string; // Reason for rejection from supervisor
  checkinTime: Date;
  checkinPhoto?: string; // Base64 encoded photo
  checkinReason?: string; // Reason if out of range
  checkinReasonPhoto?: string; // Additional photo for reason
  
  // Check-out approval workflow
  checkoutStatus?: 'pending' | 'approved' | 'rejected';
  checkoutApprovedBy?: Types.ObjectId; // Supervisor who approved/rejected
  checkoutApprovedAt?: Date;
  checkoutRejectionReason?: string; // Reason for rejection from supervisor
  checkoutTime?: Date;
  checkoutLocation?: {
    lat: number;
    lng: number;
  };
  checkoutDistance?: number;
  checkoutPhoto?: string; // Base64 encoded photo
  checkoutReason?: string; // Reason if out of range
  checkoutReasonPhoto?: string; // Additional photo for reason
  
  totalHours?: number;
}

/**
 * Attendance Schema Definition
 */
const AttendanceSchema: Schema<IAttendance> = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    office: {
      type: Schema.Types.ObjectId,
      ref: 'Office',
      required: [true, 'Office reference is required'],
    },
    officerName: {
      type: String,
      required: [true, 'Officer name is required'],
      trim: true,
    },
    officeName: {
      type: String,
      required: [true, 'Office name is required'],
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: [true, 'Latitude is required'],
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        required: [true, 'Longitude is required'],
        min: -180,
        max: 180,
      },
    },
    distance: {
      type: Number,
      required: [true, 'Distance is required'],
      min: 0,
    },
    status: {
      type: String,
      enum: ['Valid', 'Invalid'],
      required: [true, 'Status is required'],
    },
    // Check-in approval workflow
    checkinStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      required: true,
    },
    checkinApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    checkinApprovedAt: {
      type: Date,
      required: false,
    },
    checkinRejectionReason: {
      type: String,
      required: false,
    },
    checkinTime: {
      type: Date,
      default: Date.now,
      required: true,
    },
    checkinPhoto: {
      type: String,
      required: false,
    },
    checkinReason: {
      type: String,
      required: false,
    },
    checkinReasonPhoto: {
      type: String,
      required: false,
    },
    // Check-out approval workflow
    checkoutStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: false,
    },
    checkoutApprovedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
    checkoutApprovedAt: {
      type: Date,
      required: false,
    },
    checkoutRejectionReason: {
      type: String,
      required: false,
    },
    checkoutTime: {
      type: Date,
      required: false,
    },
    checkoutLocation: {
      lat: {
        type: Number,
        required: false,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        required: false,
        min: -180,
        max: 180,
      },
    },
    checkoutDistance: {
      type: Number,
      required: false,
      min: 0,
    },
    checkoutPhoto: {
      type: String,
      required: false,
    },
    checkoutReason: {
      type: String,
      required: false,
    },
    checkoutReasonPhoto: {
      type: String,
      required: false,
    },
    totalHours: {
      type: Number,
      required: false,
      min: 0,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

/**
 * Create index on checkinTime for efficient queries
 */
AttendanceSchema.index({ checkinTime: -1 });
AttendanceSchema.index({ user: 1 });
AttendanceSchema.index({ office: 1 });
AttendanceSchema.index({ status: 1 });
AttendanceSchema.index({ checkinStatus: 1 });
AttendanceSchema.index({ checkoutStatus: 1 });

/**
 * Prevent model recompilation during hot reload in development
 */
const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
