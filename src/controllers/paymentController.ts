import { Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import OnboardingSession from '../models/OnboardingSession';
import User from '../models/User';
import Twin from '../models/Twin';
import Billing from '../models/Billing';
import { createCreditPurchaseOrder } from '../services/razorpayService';
import { AuthRequest } from '../middleware/auth';

// @desc    Razorpay Payment Webhook
// @route   POST /api/payment/webhook
// @access  Public (but verified via signature)
export const handlePaymentWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET as string;
    
    // 1. Verify webhook signature
    const signature = req.headers['x-razorpay-signature'] as string;
    const body = JSON.stringify(req.body);
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('⚠️ Invalid webhook signature');
      res.status(400).json({ success: false, error: 'Invalid signature' });
      return;
    }

    const event = req.body.event;
    const payload = req.body.payload.payment.entity;

    console.log('✓ Webhook received:', event);
    console.log('Payment details:', payload);

    // 2. Handle payment success
    if (event === 'payment.captured') {
      const orderId = payload.order_id;
      const paymentId = payload.id;

      // Primary source of truth is now the Billing collection
      const billingRecord = await Billing.findOne({ 
        razorpayOrderId: orderId,
        status: 'PENDING'
      });

      if (!billingRecord) {
        console.error('⚠️ No pending billing record found for:', orderId);
        res.status(404).json({ success: false, error: 'Billing record not found' });
        return;
      }

      // 3. Process according to transaction type
      if (billingRecord.transactionType === 'PURCHASE') {
        // Handle Credit Purchase
        console.log('✓ Processing credit purchase...');
        
        billingRecord.status = 'COMPLETED';
        billingRecord.razorpayPaymentId = paymentId;
        await billingRecord.save();

        const user = await User.findById(billingRecord.userId);
        if (user) {
          user.credits = (user.credits || 0) + (billingRecord.credits || 0);
          await user.save();
          console.log(`✅ Added ${billingRecord.credits} credits to user ${user.uid}`);
        }
      } else if (billingRecord.transactionType === 'PLAN_UPGRADE') {
        // Handle Onboarding Payment
        console.log('✓ Processing onboarding payment (Twin Synthesis)...');

        const session = await OnboardingSession.findOne({ 
          razorpayOrderId: orderId,
          status: 'PENDING'
        });

        if (session) {
          // Update billing record
          billingRecord.status = 'COMPLETED';
          billingRecord.razorpayPaymentId = paymentId;
          await billingRecord.save();

          // Calculate plan expiry
          const now = new Date();
          let planExpiresAt: Date;
          if (session.planType === 'MONTHLY') {
            planExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else if (session.planType === 'YEARLY') {
            planExpiresAt = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
          } else {
            // AFTERLIFE - set to 100 years in future
            planExpiresAt = new Date(now.getFullYear() + 100, now.getMonth(), now.getDate());
          }

          // Create the Twin (Brain synthesis here)
          const brainData = {
            name: session.answers.name || 'Neural Candidate',
            occupation: session.answers.occupation || 'Digital Intelligence',
            personality: session.answers.personality || 'Analytical and adaptive.',
            voiceDescription: session.answers.voiceDescription || 'Clear and resonant.',
          };

          const twin = await Twin.create({
            creatorUid: session.userId,
            name: brainData.name,
            occupation: brainData.occupation,
            personality: brainData.personality,
            voiceDescription: brainData.voiceDescription,
            avatarStatus: 'PENDING',
            plan: session.planType,
            planExpiresAt,
            sourceVideoPath: session.sourceVideoPath,
            sourceAudioPath: session.sourceAudioPath,
            sourceThumbnailPath: session.sourceThumbnailPath,
            fidelityScore: 98.4,
            brainData: session.answers // Use full answers as brain data
          });

          // Update User Status
          await User.findByIdAndUpdate(session.userId, {
            paymentStatus: 'PAID',
            onboardingStatus: 'COMPLETED',
            razorpayId: paymentId
          });

          // Mark session as complete
          session.status = 'PAID';
          session.razorpayPaymentId = paymentId;
          await session.save();

          console.log('✅ Onboarding completed for user:', session.userId);
          console.log('✅ Twin created:', twin._id);
        } else {
          console.warn('⚠️ No onboarding session found for order:', orderId);
          // Still complete the billing record at least
          billingRecord.status = 'COMPLETED';
          billingRecord.razorpayPaymentId = paymentId;
          await billingRecord.save();
        }
      }

      res.status(200).json({ success: true });
    } else if (event === 'payment.failed') {
      const orderId = payload.order_id;
      
      // Update both possible sources
      await Billing.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { status: 'FAILED' }
      );
      
      await OnboardingSession.findOneAndUpdate(
        { razorpayOrderId: orderId },
        { status: 'FAILED' }
      );

      console.log('❌ Payment failed for order:', orderId);
      res.status(200).json({ success: true });
    } else {
      res.status(200).json({ success: true, message: 'Event ignored' });
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Check onboarding payment status
// @route   GET /api/payment/status/:sessionId
// @access  Private
export const checkPaymentStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sessionId } = req.params;

    const session = await OnboardingSession.findById(sessionId);

    if (!session) {
      res.status(404).json({ success: false, error: 'Session not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        status: session.status,
        razorpayOrderId: session.razorpayOrderId
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Initiate credit purchase
// @route   POST /api/payment/purchase-credits
// @access  Private
export const initiateCreditPurchase = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { credits, amount } = req.body;
    const userId = req.user!._id;

    // Validate credit package
    const validPackages = [
      { credits: 20, amount: 15 },
      { credits: 75, amount: 45 },
      { credits: 200, amount: 99 }
    ];

    const validPackage = validPackages.find(
      pkg => pkg.credits === credits && pkg.amount === amount
    );

    if (!validPackage) {
      res.status(400).json({ 
        success: false, 
        error: 'Invalid credit package. Please select a valid package.' 
      });
      return;
    }

    // Create Razorpay order
    const razorpayOrder = await createCreditPurchaseOrder(userId.toString(), credits, amount);

    // Create billing record
    const billingRecord = await Billing.create({
      userId,
      amount,
      credits,
      status: 'PENDING',
      transactionType: 'PURCHASE',
      razorpayOrderId: razorpayOrder.id
    });

    console.log('✓ Credit purchase order created:', razorpayOrder.id);

    res.status(200).json({
      success: true,
      data: {
        billingId: billingRecord._id,
        razorpayOrder: {
          id: razorpayOrder.id,
          amount: razorpayOrder.amount,
          currency: razorpayOrder.currency
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Check credit purchase status
// @route   GET /api/payment/credit-status/:billingId
// @access  Private
export const checkCreditPurchaseStatus = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { billingId } = req.params;

    const billing = await Billing.findById(billingId);

    if (!billing) {
      res.status(404).json({ success: false, error: 'Billing record not found' });
      return;
    }

    // Verify this billing belongs to the requesting user
    if (billing.userId.toString() !== req.user!._id.toString()) {
      res.status(403).json({ success: false, error: 'Unauthorized access' });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        status: billing.status,
        credits: billing.credits,
        amount: billing.amount,
        razorpayOrderId: billing.razorpayOrderId
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user's billing history
// @route   GET /api/payment/my-billings
// @access  Private
export const getMyBillings = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const billings = await Billing.find({ userId: req.user!._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: billings
    });
  } catch (err) {
    next(err);
  }
};
