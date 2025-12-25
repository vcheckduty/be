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
  checkinTime: Date;
  checkoutTime?: Date;
  checkoutLocation?: {
    lat: number;
    lng: number;
  };
  checkoutDistance?: number;
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
    checkinTime: {
      type: Date,
      default: Date.now,
      required: true,
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

/**
 * Prevent model recompilation during hot reload in development
 */
const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>('Attendance', AttendanceSchema);

export default Attendance;
