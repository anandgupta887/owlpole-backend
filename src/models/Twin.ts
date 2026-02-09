import mongoose, { Document, Schema } from 'mongoose';

export interface ITwin extends Document {
  creatorUid: mongoose.Types.ObjectId;
  uid: string; // The OWL-XXXXXX identifier from creator
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
  activatedAt?: Date;
  paymentStatus: 'UNPAID' | 'PAID';
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
  uid: {
    type: String,
    unique: true,
    sparse: true // Allow null during creation, will be set in pre-save
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
  activatedAt: Date,
  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'PAID'],
    default: 'PAID' // Assuming if it's created, it's paid in the current flow
  },
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

// Generate unique OWL-XXXXXX ID and track activation
TwinSchema.pre('save', async function() {
  this.updatedAt = new Date();
  
  // Generate uid if not already set
  if (!this.uid) {
    this.uid = `OWL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  }
  
  // Set activatedAt timestamp when status changes to ACTIVE
  if (this.isModified('avatarStatus') && this.avatarStatus === 'ACTIVE' && !this.activatedAt) {
    this.activatedAt = new Date();
  }
});

export default mongoose.model<ITwin>('Twin', TwinSchema);
