import mongoose, { Document, Schema } from 'mongoose';

export interface ICallHistory extends Document {
  userId: mongoose.Types.ObjectId;
  twinId: mongoose.Types.ObjectId;
  sessionId?: string;
  startTime: Date;
  endTime?: Date;
  durationSeconds: number;
  creditsUsed: number;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED';
  transcript: Array<{
    sender: 'USER' | 'AI';
    text: string;
    timestamp: Date;
  }>;
}

const CallHistorySchema = new Schema<ICallHistory>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  twinId: {
    type: Schema.Types.ObjectId,
    ref: 'Twin',
    required: true
  },
  sessionId: String,
  startTime: {
    type: Date,
    default: Date.now,
    required: true
  },
  endTime: Date,
  durationSeconds: {
    type: Number,
    default: 0
  },
  creditsUsed: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'COMPLETED', 'FAILED'],
    default: 'ACTIVE'
  },
  transcript: [{
    sender: {
      type: String,
      enum: ['USER', 'AI']
    },
    text: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
});

export default mongoose.model<ICallHistory>('CallHistory', CallHistorySchema);
