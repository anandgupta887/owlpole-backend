import mongoose, { Document, Schema } from 'mongoose';

export interface ITwin extends Document {
  creatorUid: mongoose.Types.ObjectId;
  name: string;
  occupation?: string;
  personality?: string;
  voiceDescription?: string;
  avatarStatus: 'PENDING' | 'ACTIVE' | 'REJECTED';
  heygenAvatarId?: string;
  avatarImageUrl?: string;
  sourceVideoPath?: string;
  sourceAudioPath?: string;
  sourceThumbnailPath?: string;
  fidelityScore: number;
  memoryEnabled: boolean;
  plan: 'MONTHLY' | 'YEARLY' | 'AFTERLIFE';
  planExpiresAt?: Date;
  brainData?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TwinSchema = new Schema<ITwin>({
  creatorUid: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  occupation: String,
  personality: String,
  voiceDescription: String,
  avatarStatus: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'REJECTED'],
    default: 'PENDING'
  },
  heygenAvatarId: String,
  avatarImageUrl: String,
  sourceVideoPath: String,
  sourceAudioPath: String,
  sourceThumbnailPath: String,
  fidelityScore: {
    type: Number,
    default: 0
  },
  memoryEnabled: {
    type: Boolean,
    default: false
  },
  plan: {
    type: String,
    enum: ['MONTHLY', 'YEARLY', 'AFTERLIFE'],
    default: 'MONTHLY'
  },
  planExpiresAt: Date,
  brainData: Schema.Types.Mixed,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

TwinSchema.pre('save', function() {
  this.updatedAt = new Date();
});

export default mongoose.model<ITwin>('Twin', TwinSchema);
