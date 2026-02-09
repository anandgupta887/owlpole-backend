import mongoose, { Document, Schema } from 'mongoose';

export interface IBilling extends Document {
  userId: mongoose.Types.ObjectId;
  amount: number;
  credits?: number;
  planType?: 'MONTHLY' | 'YEARLY' | 'AFTERLIFE';
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  transactionType: 'PURCHASE' | 'USAGE' | 'REFUND';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  createdAt: Date;
}

const BillingSchema = new Schema<IBilling>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  credits: Number,
  planType: {
    type: String,
    enum: ['MONTHLY', 'YEARLY', 'AFTERLIFE']
  },
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED'],
    default: 'PENDING'
  },
  transactionType: {
    type: String,
    enum: ['PURCHASE', 'USAGE', 'REFUND'],
    required: true
  },
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model<IBilling>('Billing', BillingSchema);
