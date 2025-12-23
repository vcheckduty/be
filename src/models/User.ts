import mongoose, { Schema, Model, Document } from 'mongoose';
import bcrypt from 'bcrypt';

/**
 * User roles for access control
 */
export enum UserRole {
  ADMIN = 'admin',
  OFFICER = 'officer',
  SUPERVISOR = 'supervisor',
}

/**
 * Interface for User document
 */
export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  badgeNumber?: string;
  department?: string;
  officeId?: mongoose.Types.ObjectId; // Office assignment for members
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

/**
 * User Schema Definition
 */
const UserSchema: Schema<IUser> = new Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password by default in queries
    },
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.OFFICER,
      required: true,
    },
    badgeNumber: {
      type: String,
      trim: true,
      sparse: true, // Allow multiple null values but unique non-null values
    },
    department: {
      type: String,
      trim: true,
    },
    officeId: {
      type: Schema.Types.ObjectId,
      ref: 'Office',
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Hash password before saving
 */
UserSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Method to compare password for login
 */
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    return false;
  }
};

/**
 * Create indexes for efficient queries
 */
// Note: unique: true already creates indexes for 'username' and 'email'
UserSchema.index({ role: 1 });
UserSchema.index({ isActive: 1 });

/**
 * Prevent model recompilation during hot reload in development
 */
const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
