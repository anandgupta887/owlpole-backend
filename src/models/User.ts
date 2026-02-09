import mongoose, { Document, Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

/**
 * User Interface
 * 
 * ROLE-SPECIFIC FIELD USAGE:
 * 
 * CREATOR (builds digital twins):
 *   - onboardingStatus: Progress in onboarding ('INITIAL' -> 'COMPLETED')
 *   - credits: To test/talk to their own twin (same as callers)
 *   - paymentStatus: Whether they've paid for their initial plan
 *   - razorpayId: Payment customer ID
 * 
 * CALLER (buys credits to call twins):
 *   - credits: Available calling credits (pay-per-use)
 *   - paymentStatus: Whether they've ever purchased credits
 *   - razorpayId: Payment customer ID
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
  credits: number;
  
  // User lifecycle state
  onboardingStatus: 'INITIAL' | 'FORM_FILLED' | 'PAYMENT_PENDING' | 'COMPLETED';
  
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
  onboardingStatus: {
    type: String,
    enum: ['INITIAL', 'FORM_FILLED', 'PAYMENT_PENDING', 'COMPLETED'],
    default: 'INITIAL'
  },
  razorpayId: String,
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
    // Generate the unique OWL-ID
    if (!this.uid) {
      this.uid = `OWL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    if (this.role === 'CALLER') {
      this.credits = this.credits || 0;
      this.onboardingStatus = 'COMPLETED'; // Callers skip onboarding
    } else if (this.role === 'CREATOR') {
      this.credits = this.credits || 0;
      this.onboardingStatus = this.onboardingStatus || 'INITIAL';
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
