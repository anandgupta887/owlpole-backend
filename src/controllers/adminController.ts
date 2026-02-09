import { Response } from 'express';
import { AuthRequest } from '../middleware/adminAuth';
import User from '../models/User';
import Billing from '../models/Billing';
import CallHistory from '../models/CallHistory';
import Twin from '../models/Twin';

/**
 * @desc    Get platform statistics
 * @route   GET /api/admin/stats
 * @access  Admin
 */
export const getStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Count creators and callers
    const totalCreators = await User.countDocuments({ role: 'CREATOR' });
    const totalCallers = await User.countDocuments({ role: 'CALLER' });

    // Count active creators (those with an ACTIVE twin)
    const activeCreators = await Twin.countDocuments({ 
      avatarStatus: 'ACTIVE' 
    });

    // Count total calls
    const totalCalls = await CallHistory.countDocuments();

    // Calculate total revenue from completed payments
    const revenueResult = await Billing.aggregate([
      { $match: { status: 'COMPLETED' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    res.status(200).json({
      success: true,
      data: {
        totalCreators,
        totalCallers,
        activeCreators,
        totalCalls,
        totalRevenue: Number(totalRevenue.toFixed(2))
      }
    });
  } catch (error: any) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch platform statistics',
      error: error.message
    });
  }
};

/**
 * @desc    Get all users with filters and pagination
 * @route   GET /api/admin/users
 * @access  Admin
 * @query   role, search, limit, offset
 */
export const getUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, search, limit = '10', offset = '0' } = req.query;

    // Build filter object
    const filter: any = {};

    // Filter by role if provided
    if (role && (role === 'CREATOR' || role === 'CALLER')) {
      filter.role = role;
    }

    // Search across multiple fields
    if (search && typeof search === 'string') {
      filter.$or = [
        { uid: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Parse pagination params
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Use aggregation to join with twins and get the avatar status
    const pipeline: any[] = [
      { $match: filter },
      { $sort: { createdAt: -1 } },
      { $skip: offsetNum },
      { $limit: limitNum },
      {
        $lookup: {
          from: 'twins',
          localField: '_id',
          foreignField: 'creatorUid',
          as: 'userTwins'
        }
      },
      {
        $addFields: {
          avatarStatus: {
            $let: {
              vars: {
                firstTwin: { $arrayElemAt: ['$userTwins', 0] }
              },
              in: { $ifNull: ['$$firstTwin.avatarStatus', 'PENDING'] }
            }
          }
        }
      },
      {
        $project: {
          password: 0,
          resetPasswordToken: 0,
          resetPasswordExpire: 0,
          userTwins: 0
        }
      }
    ];

    const users = await User.aggregate(pipeline);

    // Get total count for pagination
    const total = await User.countDocuments(filter);

    // Transform users to match frontend interface
    const transformedUsers = users.map(user => ({
      id: user._id.toString(),
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      onboardingStatus: user.onboardingStatus,
      avatarStatus: user.avatarStatus,
      createdAt: user.createdAt instanceof Date ? user.createdAt.getTime() : new Date(user.createdAt).getTime()
    }));

    res.status(200).json({
      success: true,
      data: transformedUsers,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum
      }
    });
  } catch (error: any) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

/**
 * @desc    Get all payments with filters and pagination
 * @route   GET /api/admin/payments
 * @access  Admin
 * @query   search, limit, offset, status, type
 */
export const getPayments = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, limit = '10', offset = '0', status, type } = req.query;

    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    const pipeline: any[] = [];

    // 1. Initial Match (Status & Type)
    const matchStage: any = {};
    if (status && ['COMPLETED', 'PENDING', 'FAILED'].includes(status as string)) {
      matchStage.status = status;
    }
    if (type && ['PURCHASE', 'USAGE', 'REFUND'].includes(type as string)) {
      matchStage.transactionType = type;
    }
    // Only add match stage if there are filters
    if (Object.keys(matchStage).length > 0) {
      pipeline.push({ $match: matchStage });
    }

    // 2. Lookup User
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'user'
      }
    });

    // 3. Unwind User
    pipeline.push({
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    });

    // 4. Search Filter
    if (search && typeof search === 'string') {
      // Escape regex special characters
      const escapedSearch = search.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      
      pipeline.push({
        $addFields: {
          paymentIdStr: { $toString: '$_id' }
        }
      });

      pipeline.push({
        $match: {
          $or: [
            { 'user.name': { $regex: escapedSearch, $options: 'i' } },
            { 'user.email': { $regex: escapedSearch, $options: 'i' } },
            { 'user.uid': { $regex: escapedSearch, $options: 'i' } },
            { 'paymentIdStr': { $regex: escapedSearch, $options: 'i' } }
          ]
        }
      });
    }

    // 5. Sort
    pipeline.push({ $sort: { createdAt: -1 } });

    // 6. Pagination & Count (Facet)
    pipeline.push({
      $facet: {
        metadata: [{ $count: 'total' }],
        data: [{ $skip: offsetNum }, { $limit: limitNum }]
      }
    });

    const result = await Billing.aggregate(pipeline);
    
    // Extract data and total
    const metadata = result[0].metadata;
    const data = result[0].data;
    const total = metadata.length > 0 ? metadata[0].total : 0;

    // Transform payments to match frontend interface
    const transformedPayments = data.map((payment: any) => {
      const user = payment.user;
      return {
        id: payment._id.toString(),
        userId: user?._id?.toString() || '',
        userUid: user?.uid || '',
        userName: user?.name || 'Unknown',
        userEmail: user?.email || '',
        amount: payment.amount,
        credits: payment.credits,
        planType: payment.planType,
        timestamp: new Date(payment.createdAt).getTime(),
        status: payment.status,
        transactionType: payment.transactionType,
        razorpayId: payment.razorpayPaymentId
      };
    });

    res.status(200).json({
      success: true,
      data: transformedPayments,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum
      }
    });
  } catch (error: any) {
    console.error('Error fetching payments:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
};

/**
 * @desc    Get all call history (for overview tab)
 * @route   GET /api/admin/calls
 * @access  Admin
 * @query   limit, offset
 */
export const getCalls = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { limit = '10', offset = '0' } = req.query;

    // Parse pagination params
    const limitNum = parseInt(limit as string, 10);
    const offsetNum = parseInt(offset as string, 10);

    // Fetch call history with user and twin population
    const calls = await CallHistory.find()
      .populate('userId', 'uid name email')
      .populate('twinId', 'name')
      .limit(limitNum)
      .skip(offsetNum)
      .sort({ startTime: -1 });

    // Get total count
    const total = await CallHistory.countDocuments();

    // Transform calls to match frontend interface
    const transformedCalls = calls.map(call => {
      const user = call.userId as any;
      const twin = call.twinId as any;
      return {
        id: call._id.toString(),
        twinId: twin?._id?.toString() || '',
        twinName: twin?.name || 'Unknown Twin',
        callerId: user?._id?.toString() || '',
        callerUid: user?.uid || '',
        callerName: user?.name || 'Unknown',
        timestamp: call.startTime.getTime(),
        durationSeconds: call.durationSeconds,
        creditsUsed: call.creditsUsed
      };
    });

    res.status(200).json({
      success: true,
      data: transformedCalls,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum
      }
    });
  } catch (error: any) {
    console.error('Error fetching calls:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call history',
      error: error.message
    });
  }
};

/**
 * @desc    Get complete user details with all related data
 * @route   GET /api/admin/users/:userId
 * @access  Admin
 */
export const getUserDetails = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Fetch user
    const user = await User.findById(userId).select('-password -resetPasswordToken -resetPasswordExpire');

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Transform user data
    const userData = {
      id: user._id.toString(),
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: user.role,
      credits: user.credits,
      onboardingStatus: user.onboardingStatus,
      createdAt: user.createdAt.getTime()
    };

    // Fetch twins if user is a creator
    let twins: any[] = [];
    if (user.role === 'CREATOR') {
      const userTwins = await Twin.find({ creatorUid: user._id });
      twins = userTwins.map(twin => ({
        id: twin._id.toString(),
        uid: twin.uid,
        creatorUid: user.uid,
        name: twin.name,
        occupation: twin.occupation,
        personality: twin.personality,
        voiceDescription: twin.voiceDescription,
        avatarStatus: twin.avatarStatus,
        heygenAvatarId: twin.heygenAvatarId,
        memoryEnabled: twin.memoryEnabled,
        plan: twin.plan,
        planExpiresAt: twin.planExpiresAt ? twin.planExpiresAt.getTime() : undefined,
        activatedAt: twin.activatedAt ? twin.activatedAt.getTime() : undefined,
        fidelityScore: twin.fidelityScore,
        createdAt: twin.createdAt.getTime()
      }));
    }

    // Fetch call history
    // For creators: get incoming calls to their twins
    // For all users: get outgoing calls they made
    let incomingCalls: any[] = [];
    let outgoingCalls: any[] = [];

    if (user.role === 'CREATOR') {
      // Get twin IDs for this creator
      const creatorTwins = await Twin.find({ creatorUid: user._id }).select('_id');
      const twinIds = creatorTwins.map(t => t._id);

      // Get incoming calls to these twins (excluding self-calls)
      const incoming = await CallHistory.find({
        twinId: { $in: twinIds },
        userId: { $ne: user._id }
      })
        .populate('userId', 'uid name email')
        .populate('twinId', 'name')
        .sort({ startTime: -1 });

      incomingCalls = incoming.map(call => {
        const caller = call.userId as any;
        const twin = call.twinId as any;
        return {
          id: call._id.toString(),
          twinId: twin?._id?.toString() || '',
          twinName: twin?.name || 'Unknown Twin',
          callerUid: caller?.uid || '',
          callerName: caller?.name || 'Unknown',
          timestamp: call.startTime.getTime(),
          durationSeconds: call.durationSeconds,
          creditsUsed: call.creditsUsed
        };
      });
    }

    // Get outgoing calls made by this user
    const outgoing = await CallHistory.find({ userId: user._id })
      .populate('twinId', 'name')
      .sort({ startTime: -1 });

    outgoingCalls = outgoing.map(call => {
      const twin = call.twinId as any;
      return {
        id: call._id.toString(),
        twinId: twin?._id?.toString() || '',
        twinName: twin?.name || 'Unknown Twin',
        timestamp: call.startTime.getTime(),
        durationSeconds: call.durationSeconds,
        creditsUsed: call.creditsUsed
      };
    });

    // Fetch payment history
    const userPayments = await Billing.find({ userId: user._id })
      .sort({ createdAt: -1 });

    const payments = userPayments.map(payment => ({
      id: payment._id.toString(),
      amount: payment.amount,
      credits: payment.credits,
      planType: payment.planType,
      timestamp: payment.createdAt.getTime(),
      status: payment.status,
      transactionType: payment.transactionType,
      razorpayId: payment.razorpayPaymentId
    }));

    // Return complete user details
    res.status(200).json({
      success: true,
      data: {
        user: userData,
        twins,
        callHistory: {
          incoming: incomingCalls,
          outgoing: outgoingCalls
        },
        payments
      }
    });
  } catch (error: any) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user details',
      error: error.message
    });
  }
};

/**
 * @desc    Activate a creator's twin and grant bonus credits
 * @route   POST /api/admin/twins/:twinId/activate
 * @access  Admin
 */
export const activateTwin = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { twinId } = req.params;
    const { heygenAvatarId } = req.body;

    if (!heygenAvatarId) {
      res.status(400).json({ success: false, message: 'HeyGen Avatar ID is required for activation' });
      return;
    }

    // 1. Find and update the twin
    const twin = await Twin.findById(twinId);
    if (!twin) {
      res.status(404).json({ success: false, message: 'Twin not found' });
      return;
    }

    twin.heygenAvatarId = heygenAvatarId;
    twin.avatarStatus = 'ACTIVE';
    await twin.save();

    // 2. Find the creator and grant 60 credits
    const user = await User.findById(twin.creatorUid);
    if (user) {
      user.credits = (user.credits || 0) + 60;
      await user.save();
    }

    res.status(200).json({
      success: true,
      data: {
        twin: {
          id: twin._id,
          avatarStatus: twin.avatarStatus,
          heygenAvatarId: twin.heygenAvatarId
        },
        newCredits: user ? user.credits : 0
      }
    });
  } catch (error: any) {
    console.error('Error activating twin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate twin',
      error: error.message
    });
  }
};

