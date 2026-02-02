import { Response } from 'express';
import { IUser } from '../models/User';

/**
 * Get token from model, create cookie and send response
 */
export const sendTokenResponse = (user: IUser, statusCode: number, res: Response): void => {
  const token = user.getSignedJwtToken();

  res.status(statusCode).json({
    success: true,
    token,
    user: {
      id: user._id,
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      onboardingComplete: user.onboardingComplete,
      paymentStatus: user.paymentStatus,
      avatarStatus: user.avatarStatus,
      memoryEnabled: user.memoryEnabled,
      heygenAvatarId: user.heygenAvatarId,
      plan: user.plan,
      planExpiresAt: user.planExpiresAt
    }
  });
};
