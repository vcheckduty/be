import mongoose, { Schema, Model, Document } from 'mongoose';

/**
 * Interface for Office document
 */
export interface IOffice extends Document {
  name: string;
  address: string;
  location: {
    lat: number;
    lng: number;
  };
  radius: number; // Check-in radius in meters
  isActive: boolean;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Office Schema Definition
 */
const OfficeSchema: Schema<IOffice> = new Schema(
  {
    name: {
      type: String,
      required: [true, 'Office name is required'],
      trim: true,
      unique: true,
    },
    address: {
      type: String,
      required: [true, 'Office address is required'],
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
    radius: {
      type: Number,
      required: [true, 'Radius is required'],
      min: 1,
      default: 50, // Default 50 meters
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Create indexes for efficient queries
 */
// Note: unique: true already creates an index for 'name'
OfficeSchema.index({ isActive: 1 });
OfficeSchema.index({ 'location.lat': 1, 'location.lng': 1 });

/**
 * Prevent model recompilation during hot reload in development
 */
const Office: Model<IOffice> =
  mongoose.models.Office || mongoose.model<IOffice>('Office', OfficeSchema);

export default Office;
