import express from 'express';
import { handlePaymentWebhook, checkPaymentStatus, initiateCreditPurchase, checkCreditPurchaseStatus, getMyBillings } from '../controllers/paymentController';
import { protect } from '../middleware/auth';

const router = express.Router();

// Webhook endpoint (public, but signature-verified)
router.post('/webhook', handlePaymentWebhook);

// Status check endpoint
router.get('/status/:sessionId', checkPaymentStatus);

// Credit purchase endpoints (protected)
router.post('/purchase-credits', protect, initiateCreditPurchase);
router.get('/credit-status/:billingId', protect, checkCreditPurchaseStatus);
router.get('/my-billings', protect, getMyBillings);

export default router;
