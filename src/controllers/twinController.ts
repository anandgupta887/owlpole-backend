import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import Twin from '../models/Twin';
import Memory from '../models/Memory';
import User from '../models/User';
import OnboardingSession from '../models/OnboardingSession';
import Billing from '../models/Billing';
import { createOnboardingOrder } from '../services/razorpayService';

// @desc    Initiate Creator Onboarding (Step 1: Upload assets + Create Razorpay Order)
// @route   POST /api/twins/initiate-onboarding
// @access  Private
export const initiateOnboarding = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { answers, planType = 'MONTHLY' } = req.body;
    const files = req.files as any;

    if (!answers) {
      res.status(400).json({ success: false, error: 'Neural answers are required' });
      return;
    }

    if (!['MONTHLY', 'YEARLY', 'AFTERLIFE'].includes(planType)) {
      res.status(400).json({ success: false, error: 'Invalid plan type selected' });
      return;
    }

    // 1. Extract file paths
    const videoPath = files['video'] ? files['video'][0].path : undefined;
    const audioPath = files['audio'] ? files['audio'][0].path : undefined;
    const thumbPath = files['thumbnail'] ? files['thumbnail'][0].path : undefined;

    // 2. Create Razorpay Order
    let razorpayOrder;
    try {
      razorpayOrder = await createOnboardingOrder(req.user!._id.toString(), planType);
    } catch (error) {
      res.status(500).json({ success: false, error: 'Payment system unavailable. Please try again.' });
      return;
    }

    // 3. Create temporary onboarding session
    let parsedAnswers: any = {};
    try {
      parsedAnswers = typeof answers === 'string' ? JSON.parse(answers) : answers;
    } catch (e) {
      parsedAnswers = answers;
    }

    const session = await OnboardingSession.create({
      userId: req.user!._id,
      answers: parsedAnswers,
      planType,
      sourceVideoPath: videoPath,
      sourceAudioPath: audioPath,
      sourceThumbnailPath: thumbPath,
      razorpayOrderId: razorpayOrder.id,
      status: 'PENDING'
    });

    // 4. Create Billing record for unified history
    await Billing.create({
      userId: req.user!._id,
      amount: razorpayOrder.amount / 100, // Razorpay amount is in cents
      planType,
      status: 'PENDING',
      transactionType: 'PURCHASE',
      razorpayOrderId: razorpayOrder.id
    });

    console.log('✓ Onboarding session created:', session._id);
    console.log('✓ Razorpay order created:', razorpayOrder.id);

    res.status(200).json({
      success: true,
      message: 'Assets secured. Payment order created.',
      data: {
        sessionId: session._id,
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

// @desc    Get all user's twins
// @route   GET /api/twins
// @access  Private
export const getTwins = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const twins = await Twin.find({ creatorUid: req.user!._id });

    res.status(200).json({
      success: true,
      count: twins.length,
      data: twins
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single twin
// @route   GET /api/twins/:id
// @access  Private
export const getTwin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const twin = await Twin.findById(req.params.id);

    if (!twin) {
      res.status(404).json({ success: false, error: 'Twin not found' });
      return;
    }

    if (twin.creatorUid.toString() !== req.user!._id.toString() && req.user!.role !== 'ADMIN') {
      res.status(401).json({ success: false, error: 'Not authorized to access this twin' });
      return;
    }

    res.status(200).json({
      success: true,
      data: twin
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create new twin
// @route   POST /api/twins
// @access  Private
export const createTwin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    req.body.creatorUid = req.user!._id;

    const twin = await Twin.create(req.body);

    res.status(201).json({
      success: true,
      data: twin
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update twin
// @route   PUT /api/twins/:id
// @access  Private
export const updateTwin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    let twin = await Twin.findById(req.params.id);

    if (!twin) {
      res.status(404).json({ success: false, error: 'Twin not found' });
      return;
    }

    if (twin.creatorUid.toString() !== req.user!._id.toString() && req.user!.role !== 'ADMIN') {
      res.status(401).json({ success: false, error: 'Not authorized to update this twin' });
      return;
    }

    twin = await Twin.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })!;

    res.status(200).json({
      success: true,
      data: twin
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete twin
// @route   DELETE /api/twins/:id
// @access  Private
export const deleteTwin = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const twin = await Twin.findById(req.params.id);

    if (!twin) {
      res.status(404).json({ success: false, error: 'Twin not found' });
      return;
    }

    if (twin.creatorUid.toString() !== req.user!._id.toString() && req.user!.role !== 'ADMIN') {
      res.status(401).json({ success: false, error: 'Not authorized to delete this twin' });
      return;
    }

    await twin.deleteOne();
    await Memory.deleteMany({ twinId: req.params.id });

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(err);
  }
};
