import Razorpay from 'razorpay';

let razorpay: Razorpay | null = null;

/**
 * Get or create Razorpay instance
 */
const getRazorpayInstance = (): Razorpay => {
  if (!razorpay) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    console.log('Initializing Razorpay with Key ID:', keyId ? `${keyId.substring(0, 8)}...` : 'MISSING');

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env');
    }

    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpay;
};

/**
 * Create a Razorpay Order for onboarding payment
 */
export const createOnboardingOrder = async (userId: string, planType: string = 'MONTHLY'): Promise<any> => {
  try {
    const razorpayInstance = getRazorpayInstance();
    
    // Receipt must be ≤40 chars. Format: onboard_XXXXX_timestamp
    const shortUserId = userId.substring(userId.length - 8); // Last 8 chars of ObjectId
    const timestamp = Date.now().toString().substring(3); // Remove first 3 digits
    const receipt = `onboard_${shortUserId}_${timestamp}`;
    
    const amount = planType === 'YEARLY' ? 79200 : 6900;

    console.log('Attempting order creation with:', {
      amount,
      currency: 'USD',
      receipt: receipt
    });

    const order = await razorpayInstance.orders.create({
      amount: amount, 
      currency: 'USD',
      receipt: receipt,
      notes: {
        purpose: 'Creator Onboarding',
        userId: userId,
        planType
      }
    });

    return order;
  } catch (error: any) {
    console.error('Razorpay Order Creation Error:', error);
    throw new Error('Failed to create payment order');
  }
};

/**
 * Create a Razorpay Order for credit purchase
 * @param userId - User's database ID
 * @param credits - Number of credits to purchase (20, 75, or 200)
 * @param amount - Amount in dollars
 */
export const createCreditPurchaseOrder = async (
  userId: string, 
  credits: number, 
  amount: number
): Promise<any> => {
  try {
    const razorpayInstance = getRazorpayInstance();
    
    // Receipt must be ≤40 chars. Format: credits_XXXXX_timestamp
    const shortUserId = userId.substring(userId.length - 8);
    const timestamp = Date.now().toString().substring(3);
    const receipt = `credits_${shortUserId}_${timestamp}`;
    
    // Convert amount to smallest currency unit (cents for USD)
    const amountInCents = Math.round(amount * 100);
    
    const order = await razorpayInstance.orders.create({
      amount: amountInCents,
      currency: 'USD',
      receipt: receipt,
      notes: {
        purpose: 'Credit Purchase',
        userId: userId,
        credits: credits.toString()
      }
    });

    return order;
  } catch (error: any) {
    console.error('Razorpay Credit Order Creation Error:', error);
    throw new Error('Failed to create credit purchase order');
  }
};
