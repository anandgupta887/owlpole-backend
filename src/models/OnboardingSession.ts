import mongoose, { Document, Schema } from 'mongoose';

/**
 * Temporary storage for onboarding data until payment is confirmed
 */
export interface IOnboardingSession extends Document {
  userId: mongoose.Types.ObjectId;
  answers: any;
  sourceVideoPath?: string;
  sourceAudioPath?: string;
  sourceThumbnailPath?: string;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  createdAt: Date;
  expiresAt: Date;
}

const OnboardingSessionSchema = new Schema<IOnboardingSession>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  answers: {
    type: Schema.Types.Mixed,
    required: true
  },
  sourceVideoPath: String,
  sourceAudioPath: String,
  sourceThumbnailPath: String,
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: String,
  status: {
    type: String,
    enum: ['PENDING', 'PAID', 'FAILED', 'EXPIRED'],
    default: 'PENDING'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
  }
});

// Auto-delete expired sessions
OnboardingSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IOnboardingSession>('OnboardingSession', OnboardingSessionSchema);
