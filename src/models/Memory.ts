import mongoose, { Document, Schema } from 'mongoose';

export interface IMemory extends Document {
  twinId: mongoose.Types.ObjectId;
  content: string;
  importance: number;
  source: 'MANUAL' | 'CHAT' | 'ONBOARDING';
  createdAt: Date;
}

const MemorySchema = new Schema<IMemory>({
  twinId: {
    type: Schema.Types.ObjectId,
    ref: 'Twin',
    required: true
  },
  content: {
    type: String,
    required: [true, 'Please add memory content']
  },
  importance: {
    type: Number,
    default: 1,
    min: 1,
    max: 10
  },
  source: {
    type: String,
    enum: ['MANUAL', 'CHAT', 'ONBOARDING'],
    default: 'MANUAL'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IMemory>('Memory', MemorySchema);
