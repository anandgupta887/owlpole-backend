import express from 'express';
import { getStats, getUsers, getPayments, getCalls, getUserDetails } from '../controllers/adminController';
import { verifyAdmin } from '../middleware/adminAuth';

const router = express.Router();

/**
 * All routes require admin authentication
 */

// @route   GET /api/admin/stats
// @desc    Get platform statistics
// @access  Admin
router.get('/stats', verifyAdmin, getStats);

// @route   GET /api/admin/users
// @desc    Get all users with filters (role, search, pagination)
// @access  Admin
router.get('/users', verifyAdmin, getUsers);

// @route   GET /api/admin/payments
// @desc    Get all payments with filters (search, pagination, status, type)
// @access  Admin
router.get('/payments', verifyAdmin, getPayments);

// @route   GET /api/admin/calls
// @desc    Get all call history with pagination
// @access  Admin
router.get('/calls', verifyAdmin, getCalls);

// @route   GET /api/admin/users/:userId
// @desc    Get complete user details with twins, calls, and payments
// @access  Admin
router.get('/users/:userId', verifyAdmin, getUserDetails);

export default router;
