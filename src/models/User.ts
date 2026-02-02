import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * User Interface
 * 
 * ROLE-SPECIFIC FIELD USAGE:
 * 
 * CREATOR (builds digital twins):
 *   - plan: Subscription tier (FREE/YEARLY/AFTERLIFE) - to host avatar
 *   - planExpiresAt: Subscription expiry date
 *   - avatarStatus: Status of their digital avatar
 *   - heygenAvatarId: HeyGen video avatar ID
 *   - memoryEnabled: Can their twin remember conversations
 *   - credits: To test/talk to their own twin (same as callers)
 *   - paymentStatus: Whether they've paid for their plan
 *   - razorpayId: Payment customer ID
 * 
 * CALLER (buys credits to call twins):
 *   - credits: Available calling credits (pay-per-use)
 *   - paymentStatus: Whether they've ever purchased credits
 *   - razorpayId: Payment customer ID
 *   - plan: NOT USED (callers don't have subscriptions)
 *   - avatarStatus: NOT USED (callers don't create avatars)
 *   - memoryEnabled: NOT USED
 * 
 * ADMIN (platform managers):
 *   - All restrictions bypassed, premium fields ignored
 */
export interface IUser extends Document {
  name: string;
  email: string;
  role: 'CREATOR' | 'CALLER' | 'ADMIN';
  password: string;
  uid: string; // The OWL-XXXXXX identifier
  
  // Credits (used by both CREATORS and CALLERS)
  // - CREATORS: To test/talk to their own twin
  // - CALLERS: To call any twin (pay-per-use)
  credits: number;
  
  onboardingComplete: boolean;
  paymentStatus?: 'UNPAID' | 'PAID';
  
  // CREATOR-ONLY FIELDS
  avatarStatus?: 'PENDING' | 'ACTIVE' | 'REJECTED';  // Creator's avatar status
  memoryEnabled?: boolean;                            // Creator's twin memory feature
  heygenAvatarId?: string;                          // Creator's HeyGen avatar ID
  plan?: 'FREE' | 'YEARLY' | 'AFTERLIFE';           // Creator's subscription (NOT for callers)
  planExpiresAt?: Date;                              // Creator's plan expiry (NOT for callers)
  
  // Payment integration (CREATOR & CALLER)
  razorpayId?: string;
  
  // Password reset
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  getSignedJwtToken(): string;
  matchPassword(enteredPassword: string): Promise<boolean>;
  getResetPasswordToken(): string;
}

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  role: {
    type: String,
    enum: ['CREATOR', 'CALLER', 'ADMIN'],
    default: 'CREATOR'
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  uid: {
    type: String,
    unique: true
  },
  credits: {
    type: Number,
    default: 0
  },
  onboardingComplete: {
    type: Boolean,
    default: false
  },
  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'PAID']
  },
  avatarStatus: {
    type: String,
    enum: ['PENDING', 'ACTIVE', 'REJECTED']
  },
  memoryEnabled: {
    type: Boolean,
    default: false
  },
  heygenAvatarId: String,
  razorpayId: String,
  plan: {
    type: String,
    enum: ['FREE', 'YEARLY', 'AFTERLIFE']
  },
  planExpiresAt: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Set role-specific defaults before saving
UserSchema.pre('save', function() {
  if (this.isNew) {
    // Generate the unique OWL-ID (Matches legacy logic)
    if (!this.uid) {
      this.uid = `OWL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    if (this.role === 'CALLER') {
      // Callers get free welcome credits (pay-per-use model)
      this.credits = this.credits || 60;
      this.onboardingComplete = true; // Callers skip onboarding
      
      // Remove creator-only fields from the database document
      this.plan = undefined;
      this.planExpiresAt = undefined;
      this.avatarStatus = undefined;
      this.memoryEnabled = undefined;
      // paymentStatus can remain if we use it for credit purchase status, 
      // but if you want it gone for callers too:
      this.paymentStatus = undefined;
    } else if (this.role === 'CREATOR') {
      // Creators get BOTH plan AND credits
      this.credits = this.credits || 60;
      this.plan = this.plan || 'FREE';
      this.planExpiresAt = this.planExpiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      this.avatarStatus = this.avatarStatus || 'PENDING';
      this.memoryEnabled = this.memoryEnabled || false;
      this.paymentStatus = this.paymentStatus || 'UNPAID';
      this.onboardingComplete = this.onboardingComplete || false;
    }
  }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Update the updatedAt field on save
UserSchema.pre('save', function() {
  this.updatedAt = new Date();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function(): string {
  return jwt.sign(
    { id: this._id.toString(), role: this.role },
    process.env.JWT_SECRET as string,
    { expiresIn: process.env.JWT_EXPIRE || '7d' } as jwt.SignOptions
  );
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword: string): Promise<boolean> {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash password reset token
UserSchema.methods.getResetPasswordToken = function(): string {
  const crypto = require('crypto');
  
  // Generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  // Hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000);

  return resetToken;
};

export default mongoose.model<IUser>('User', UserSchema);
