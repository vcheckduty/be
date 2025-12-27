import mongoose, { Schema, Document } from 'mongoose';

export interface IConversation extends Document {
  participants: mongoose.Types.ObjectId[];
  lastMessage: mongoose.Types.ObjectId;
  unreadCounts: Map<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

const conversationSchema = new Schema<IConversation>(
  {
    participants: [{
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }],
    lastMessage: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    unreadCounts: {
      type: Map,
      of: Number,
      default: {}
    }
  },
  { 
    timestamps: true 
  }
);

// Index for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

export default mongoose.models.Conversation || mongoose.model<IConversation>('Conversation', conversationSchema);
