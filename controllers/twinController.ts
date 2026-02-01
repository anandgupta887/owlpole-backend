import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import Twin from '../models/Twin';
import Memory from '../models/Memory';

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
