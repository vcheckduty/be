import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMessage extends Document {
  sender: mongoose.Types.ObjectId;
  receiver: mongoose.Types.ObjectId;
  content: string;
  type: 'text' | 'image' | 'file';
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
  readAt?: Date;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentSize?: number;
}

const messageSchema = new Schema<IMessage>({
  sender: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ['text', 'image', 'file'],
    default: 'text',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent',
  },
  readAt: {
    type: Date,
  },
  attachmentUrl: {
    type: String,
  },
  attachmentName: {
    type: String,
  },
  attachmentSize: {
    type: Number,
  },
}, {
  timestamps: true,
});

// Indexes for faster queries
messageSchema.index({ sender: 1, receiver: 1, timestamp: -1 });
messageSchema.index({ receiver: 1, status: 1 });

export const Message: Model<IMessage> = 
  mongoose.models.Message || mongoose.model<IMessage>('Message', messageSchema);
